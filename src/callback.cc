#include <glib.h>
#include <nan.h>

#include "callback.h"
#include "closure.h"
#include "debug.h"
#include "error.h"
#include "gobject.h"
#include "loop.h"
#include "macros.h"
#include "type.h"
#include "value.h"

using v8::Context;
using v8::Function;
using v8::HandleScope;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::Value;
using Nan::TryCatch;

namespace GNodeJS {

static guint callbackLevel = 0;
static GSList* notifiedCallbacks = NULL;

static Local<Object> GetSelfInstance(GIArgument **args) {
    return WrapperFromGObject((GObject *)args[0]->v_pointer).As<Object>();
}


Callback::Callback(Local<Function> fn, GICallableInfo* callback_info, GIScopeType scope_type_) {
    persistent.Reset(fn);
    info = g_base_info_ref (callback_info);
    closure = g_callable_info_prepare_closure(info, &cif, Callback::Call, this);
    scope_type = scope_type_;
}

Callback::~Callback() {
    persistent.Reset();
    g_callable_info_free_closure (this->info, this->closure);
    g_base_info_unref (this->info);
}


/**
 * Destroy notifier function. Might be called from within the callback, therefore
 * we can't free the resources here. They'll be freed in Callback::AsyncFree.
 */
void Callback::DestroyNotify (void* user_data) {
    notifiedCallbacks = g_slist_prepend (notifiedCallbacks, user_data);
}

/**
 * Frees the callbacks that have been destroy-notified
 */
void Callback::AsyncFree () {
    if (notifiedCallbacks == NULL || callbackLevel > 0)
        return;

    GSList* current = notifiedCallbacks;

    while (current != NULL) {
        Callback* callback = static_cast<Callback*>(current->data);
        delete callback;

        current = current->next;
    }

    notifiedCallbacks = NULL;
}

/**
 * FFI closure callback
 */
void Callback::Execute (GIArgument *result, GIArgument **args, Callback *callback) {
    Isolate *isolate = Isolate::GetCurrent ();
    HandleScope scope(isolate);
    Local<Context> context = Context::New(isolate);
    Context::Scope context_scope(context);

    GITypeInfo return_type_info;
    g_callable_info_load_return_type (callback->info, &return_type_info);

    bool isVFunc = g_base_info_get_type(callback->info) == GI_INFO_TYPE_VFUNC;

    /*
     * Prepare function arguments
     */

    /* Skip the object instance in first place */
    int args_offset = isVFunc ? 1 : 0;
    guint n_native_args = (guint) g_callable_info_get_n_args(callback->info);
    guint n_return_values = 1;

    guint primitive_out_arguments_mask = 0;

    #ifndef __linux__
        Local<Value>* js_args = new Local<Value>[n_native_args];
    #else
        Local<Value> js_args[n_native_args];
    #endif

    for (guint i = 0; i < n_native_args; i++) {
        GIArgInfo arg_info;
        GITypeInfo arg_type;
        g_callable_info_load_arg (callback->info, i, &arg_info);
        g_arg_info_load_type (&arg_info, &arg_type);

        bool isOutArgument = g_arg_info_get_direction(&arg_info) == GI_DIRECTION_OUT;
        bool isPrimitive = Type::IsPrimitive(&arg_type);
        bool mustCopy = isOutArgument ? false : true;

        if (isPrimitive && isOutArgument) {
            n_return_values += 1;
            primitive_out_arguments_mask |= 1 << i;
            js_args[i] = Nan::Null();
        } else {
            js_args[i] = GIArgumentToV8 (&arg_type, args[i + args_offset], -1, mustCopy);
        }
    }

    /*
     * Make the function call
     */

    Local<Function> function = Nan::New<Function>(callback->persistent);
    Local<Object> self = isVFunc ?
        GetSelfInstance(args) : Nan::GetCurrentContext()->Global();

    Nan::TryCatch try_catch;

    callbackLevel++;
    auto maybeReturnValue = Nan::Call(function, self, n_native_args, js_args);
    callbackLevel--;

    /*
     * Marshal return values
     */

    if (!maybeReturnValue.IsEmpty()) {
        bool hasVoidReturn = Type::IsVoid(&return_type_info);
        auto jsReturnValue = maybeReturnValue.ToLocalChecked();
        auto jsRealReturnValue = jsReturnValue;
        Local<Array> jsReturnArray;
        guint returnIndex = 0;
        bool success;
        bool isOutPrimitive;
        guint n_js_return_values = n_return_values - (hasVoidReturn ? 1 : 0);

        GIArgInfo arg_info;
        GITypeInfo arg_type;

        if (n_return_values > 1) {
            if (!jsReturnValue->IsArray()) {
                Throw::Error("Virtual function must return %i arguments but return value was not an array",
                        n_js_return_values);
                goto out;
            }

            jsReturnArray = jsReturnValue.As<Array>();

            if (jsReturnArray->Length() != n_js_return_values) {
                Throw::Error("Virtual function must return %u arguments but returned %u",
                        n_js_return_values, jsReturnArray->Length());
            }

            if (hasVoidReturn)
                jsRealReturnValue = Nan::Null();
            else
                jsRealReturnValue = Nan::Get(jsReturnArray, returnIndex++).ToLocalChecked();

            for (guint i = 0; i < n_native_args; i++) {
                isOutPrimitive = (primitive_out_arguments_mask & (1 << i)) != 0;
                if (!isOutPrimitive)
                    continue;

                g_callable_info_load_arg (callback->info, i, &arg_info);
                g_arg_info_load_type (&arg_info, &arg_type);

                success = V8ToOutGIArgument(
                        &arg_type,
                        args[i + args_offset],
                        Nan::Get(jsReturnArray, returnIndex++).ToLocalChecked(),
                        g_arg_info_may_be_null(&arg_info));

                if (!success) {
                    Throw::InvalidReturnValue (&return_type_info, jsReturnValue);
                }
            }
        }

        success = V8ToGIArgument(
                &return_type_info,
                result,
                jsRealReturnValue,
                g_callable_info_may_return_null (callback->info));

        if (!success) {
            Throw::InvalidReturnValue (&return_type_info, jsReturnValue);
            goto out;
        }
    }

    // TODO: assess transferness of arguments & check if we need to free them

out:

    if (try_catch.HasCaught()) {
        GNodeJS::QuitLoopStack();
        try_catch.ReThrow();
    }

    #ifndef __linux__
        delete[] js_args;
    #endif
}

void Callback::Call (ffi_cif *cif, void *result, void **args, gpointer user_data) {
    Callback *callback = static_cast<Callback *>(user_data);
    GIArgument *gi_result = reinterpret_cast<GIArgument *>(result);
    GIArgument **gi_args = reinterpret_cast<GIArgument **>(args);

    AsyncCallEnvironment* env = reinterpret_cast<AsyncCallEnvironment *>(AsyncCallEnvironment::asyncHandle.data);
    if (env->IsSameThread()) {
        Callback::Execute(gi_result, gi_args, callback);
    } else {
        env->Call([&]() {
            Callback::Execute(gi_result, gi_args, callback);
        });
    }

    if (callback->scope_type == GI_SCOPE_TYPE_ASYNC) {
        delete callback;
    }
}


};
