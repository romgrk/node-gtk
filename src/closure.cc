#include <glib.h>
#include <nan.h>

#include "closure.h"
#include "macros.h"
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

GClosure *Closure::New (Local<Function> function, GICallableInfo* info, guint signalId) {
    Closure *closure = (Closure *) g_closure_new_simple (sizeof (*closure), GUINT_TO_POINTER(signalId));
    closure->persistent.Reset(function);
    if (info) {
        closure->info = g_base_info_ref(info);
    } else {
        closure->info = NULL;
    }
    GClosure *gclosure = &closure->base;
    g_closure_set_marshal (gclosure, Closure::Marshal);
    g_closure_add_invalidate_notifier (gclosure, NULL, Closure::Invalidated);
    return gclosure;
}

void Closure::Execute(GICallableInfo *info, guint signal_id,
                      const Nan::Persistent<v8::Function> &persFn,
                      GValue *g_return_value, uint n_param_values,
                      const GValue *param_values) {
    Nan::HandleScope scope;
    auto func = Nan::New<Function>(persFn);

    GSignalQuery signal_query = { 0, };

    g_signal_query(signal_id, &signal_query);

    // We don't pass the implicit instance as first argument
    uint n_js_args = n_param_values - 1;

    #ifndef __linux__
        Local<Value>* js_args = new Local<Value>[n_js_args];
    #else
        Local<Value> js_args[n_js_args];
    #endif

    if (info) {
        /* CallableInfo is available: use GIArgumentToV8 */
        GIArgument argument;
        GIArgInfo arg_info;
        GITypeInfo type_info;
        for (uint i = 1; i < n_param_values; i++) {
            memcpy(&argument, &param_values[i].data[0], sizeof(GIArgument));
            g_callable_info_load_arg(info, i - 1, &arg_info);
            g_arg_info_load_type(&arg_info, &type_info);

            bool mustCopy = true;

            if (signal_query.signal_id) {
                mustCopy = (signal_query.param_types[i - 1] & G_SIGNAL_TYPE_STATIC_SCOPE) == 0;
            }
            if (g_arg_info_get_direction(&arg_info) == GI_DIRECTION_OUT) {
                mustCopy = false;
            }

            js_args[i - 1] = GIArgumentToV8(&type_info, &argument, -1, mustCopy);
        }
    } else {
        /* CallableInfo is not available: use GValueToV8 */
        for (uint i = 1; i < n_param_values; i++) {
            bool mustCopy = true;

            if (signal_query.signal_id) {
                mustCopy = (signal_query.param_types[i - 1] & G_SIGNAL_TYPE_STATIC_SCOPE) == 0;
            }
            js_args[i - 1] = GValueToV8(&param_values[i], mustCopy);
        }
    }

    Local<Object> self = func;
    Local<Value> return_value;

    Nan::TryCatch try_catch;

    auto result = Nan::Call(func, self, n_js_args, js_args);

    if (!try_catch.HasCaught()
            && result.ToLocal(&return_value)) {
        if (g_return_value) {
            if (G_VALUE_TYPE(g_return_value) == G_TYPE_INVALID)
                WARN ("Marshal: return value has invalid g_type");
            else if (!V8ToGValue (g_return_value, return_value, true))
                WARN ("Marshal: could not convert return value");
        }

        CallMicrotaskHandlers ();
    }
    else {
        GNodeJS::QuitLoopStack();
        Nan::FatalException (try_catch);
    }

    #ifndef __linux__
        delete[] js_args;
    #endif
}

void Closure::Marshal(GClosure     *base,
                      GValue       *g_return_value,
                      uint          n_param_values,
                      const GValue *param_values,
                      gpointer      invocation_hint,
                      gpointer      marshal_data) {

    auto closure = (Closure *) base;
    auto signal_id = GPOINTER_TO_UINT(marshal_data);

    AsyncCallEnvironment* env = reinterpret_cast<AsyncCallEnvironment *>(AsyncCallEnvironment::asyncHandle.data);

    if (env->IsSameThread()) {
        /* Case 1: same thread */
        Closure::Execute(closure->info, signal_id, closure->persistent, g_return_value, n_param_values, param_values);
    } else {
        /* Case 2: different thread */
        env->Call([&]() {
            Closure::Execute(closure->info, signal_id, closure->persistent, g_return_value, n_param_values, param_values);
        });
    }
}
void Closure::Invalidated (gpointer data, GClosure *base) {
    Closure *closure = (Closure *) base;
    closure->~Closure();
}

};
