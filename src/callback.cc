#include <glib.h>
#include <nan.h>

#include "callback.h"
#include "closure.h"
#include "debug.h"
#include "error.h"
#include "loop.h"
#include "type.h"
#include "value.h"

using v8::Context;
using v8::Function;
using v8::HandleScope;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::Value;
using Nan::Persistent;
using Nan::TryCatch;

namespace GNodeJS {

static bool isInsideCallback = false;

static GSList* notifiedCallbacks = NULL;


Callback::Callback(Local<Function> fn, GICallableInfo* callback_info, GIArgInfo* arg_info) {
    persistent.Reset(fn);
    info = g_base_info_ref (callback_info);
    closure = g_callable_info_prepare_closure(info, &cif, Callback::Call, this);
    scope_type = g_arg_info_get_scope (arg_info);
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
    if (isInsideCallback)
        notifiedCallbacks = g_slist_prepend (notifiedCallbacks, user_data);
    else
        delete static_cast<Callback*>(user_data);
}

/**
 * Frees the callbacks that have been destroy-notified
 */
void Callback::AsyncFree () {
    if (isInsideCallback || notifiedCallbacks == NULL)
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
void Callback::Call (ffi_cif *cif, void *result, void **args, gpointer user_data) {
    Callback *callback = static_cast<Callback *>(user_data);

    int n_native_args = g_callable_info_get_n_args(callback->info);

    #ifndef __linux__
        Local<Value>* js_args = new Local<Value>[n_native_args];
    #else
        Local<Value> js_args[n_native_args];
    #endif

    GIArgument **gi_args = reinterpret_cast<GIArgument **>(args);

    for (int i = 0; i < n_native_args; i++) {
        GIArgInfo arg_info;
        GITypeInfo arg_type;
        g_callable_info_load_arg (callback->info, i, &arg_info);
        g_arg_info_load_type (&arg_info, &arg_type);

        js_args[i] = GIArgumentToV8 (&arg_type, gi_args[i]);
    }

    Local<Function> function = Nan::New<Function>(callback->persistent);
    Local<Object> self = Nan::GetCurrentContext()->Global();

    Isolate *isolate = Isolate::GetCurrent ();
    HandleScope scope(isolate);
    Local<Context> context = Context::New(isolate);
    Context::Scope context_scope(context);
    Nan::TryCatch try_catch;

    isInsideCallback = true;
    auto return_value = Nan::Call(function, self, n_native_args, js_args);
    isInsideCallback = false;

    if (!return_value.IsEmpty()) {
        GITypeInfo type_info;
        g_callable_info_load_return_type (callback->info, &type_info);

        bool didConvert = V8ToGIArgument (
                &type_info,
                (GIArgument *) &result,
                return_value.ToLocalChecked(),
                g_callable_info_may_return_null (callback->info));

        if (!didConvert) {
            Throw::InvalidReturnValue (&type_info, return_value.ToLocalChecked());
        }
    }

    if (try_catch.HasCaught()) {
        GNodeJS::QuitLoopStack();
        try_catch.ReThrow();
    }

    #ifndef __linux__
        delete[] js_args;
    #endif

    if (callback->scope_type == GI_SCOPE_TYPE_ASYNC) {
        delete callback;
    }
}


};
