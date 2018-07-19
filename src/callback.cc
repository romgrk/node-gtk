#include <glib.h>
#include <nan.h>

#include "callback.h"
#include "closure.h"
#include "debug.h"
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

namespace GNodeJS {

Callback* MakeCallback (Local<Function> function, GICallableInfo* info, GIArgInfo* arg_info) {
    Callback* callback = new Callback();
    callback->persistent.Reset(function);
    callback->closure =
      g_callable_info_prepare_closure(info, &callback->cif, Callback::Call, callback->closure);
    callback->info = g_base_info_ref (info);
    callback->scope_type = g_arg_info_get_scope (arg_info);

    return callback;
}

Callback::~Callback() {
    persistent.Reset();
    g_callable_info_free_closure (this->info, this->closure);
    g_base_info_unref (info);
}


void Callback::DestroyNotify(void* user_data) {
    Callback* callback = static_cast<Callback*>(user_data);
    delete callback;
}

void Callback::Call(ffi_cif *cif, void *result, void **args, gpointer user_data) {
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

        if (g_type_info_get_tag (&arg_type) == GI_TYPE_TAG_VOID) {
            continue;
        }

        js_args[i] = GIArgumentToV8 (&arg_type, gi_args[i]);
    }

    Local<Function> function = Nan::New<Function>(callback->persistent);
    Local<Object> self = Nan::GetCurrentContext()->Global();

    auto return_value = Nan::Call(function, self, n_native_args, js_args);

    if (!return_value.IsEmpty()) {
        GITypeInfo type_info;
        g_callable_info_load_return_type (callback->info, &type_info);

        V8ToGIArgument (&type_info, (GIArgument *) &result, return_value.ToLocalChecked(),
                g_callable_info_may_return_null (callback->info));
    }
    else {
        // TODO(error handling)
    }

    #ifndef __linux__
        delete[] js_args;
    #endif

    if (callback->scope_type == GI_SCOPE_TYPE_ASYNC)
        delete callback;
}


};
