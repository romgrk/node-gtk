#include "callback_wrapper.h"
#include "macros.h"
#include "loop.h"
#include "value.h"

using v8::Object;
using v8::Value;

namespace GNodeJS {

CallbackWrapper::CallbackWrapper(
    GICallableInfo *info, guint signal_id,
    const Nan::Persistent<v8::Function> *persistent, GValue *returnValue,
    uint nValues, const GValue *values)
    : info(info),
      signal_id(signal_id),
      persistent(persistent),
      returnValue(returnValue),
      nValues(nValues) {
    uv_mutex_init(&mutex);
    uv_mutex_lock(&mutex);
    uv_cond_init(&cond);

    // copy values
    if (info) g_base_info_ref(info);
    this->values = new GValue[nValues];
    for (uint i = 0; i < nValues; ++i) {
        this->values[i] = G_VALUE_INIT;
        g_value_init(&this->values[i], G_VALUE_TYPE(&values[i]));
        g_value_copy(&values[i], &this->values[i]);
    }
}

CallbackWrapper::~CallbackWrapper() {
    if (info) g_base_info_unref(info);
    for (uint i = 0; i < nValues; ++i) {
        g_value_unset(&values[i]);
    }
    delete[] values;

    uv_mutex_unlock(&mutex);
    uv_cond_destroy(&cond);
    uv_mutex_destroy(&mutex);
}

void CallbackWrapper::Execute(GICallableInfo *info, guint signal_id,
                      const Nan::Persistent<v8::Function> &persFn,
                      GValue *g_return_value, uint n_param_values,
                      const GValue *param_values) {
    Nan::HandleScope scope;
    auto fn = Nan::New<Function>(persFn);

    GSignalQuery signal_query = { 0, };
    g_signal_query(signal_id, &signal_query);

    uint n_js_args = n_param_values - 1;
    #ifndef __linux__
        Local<Value> *js_args = new Local<Value>[n_js_args];
    #else
        Local<Value> js_args[n_js_args];
    #endif

    if (info) {
        /* CallableInfo is available: use GIArgumentToV8 */
        g_base_info_ref(info);
        GIArgument argument;
        GIArgInfo arg_info;
        GITypeInfo type_info;
        for (uint i = 0; i < n_js_args; i++) {
            memcpy(&argument, &param_values[i + 1].data[0], sizeof(GIArgument));
            g_callable_info_load_arg(info, i, &arg_info);
            g_arg_info_load_type(&arg_info, &type_info);

            bool mustCopy = true;

            if (signal_query.signal_id) {
                mustCopy = (signal_query.param_types[i] & G_SIGNAL_TYPE_STATIC_SCOPE) == 0;
            }

            js_args[i] = GIArgumentToV8(&type_info, &argument, -1, mustCopy);
        }
        g_base_info_unref(info);
    } else {
        /* CallableInfo is not available: use GValueToV8 */
        for (uint i = 0; i < n_js_args; i++) {
            bool mustCopy = true;

            if (signal_query.signal_id) {
                mustCopy = (signal_query.param_types[i] & G_SIGNAL_TYPE_STATIC_SCOPE) == 0;
            }
            js_args[i] = GValueToV8(&param_values[i + 1], mustCopy);
        }
    }

    Local<Object> self = fn;
    Local<Value> return_value;

    Nan::TryCatch try_catch;

    auto result = Nan::Call(fn, self, n_js_args, js_args);

    if (!try_catch.HasCaught() && result.ToLocal(&return_value)) {
        if (g_return_value) {
            if (G_VALUE_TYPE(g_return_value) == G_TYPE_INVALID)
            WARN("Marshal: return value has invalid g_type");
            else if (!V8ToGValue(g_return_value, return_value, true))
            WARN("Marshal: could not convert return value");
        }
        CallMicrotaskHandlers();
    } else {
        GNodeJS::QuitLoopStack();
        Nan::FatalException(try_catch);
    }

    #ifndef __linux__
        delete[] js_args;
    #endif
}

void CallbackWrapper::Execute() {
    CallbackWrapper::Execute(info, signal_id, *persistent, returnValue, nValues, values);
    Done();
}

void CallbackWrapper::Done() {
    uv_mutex_lock(&mutex);
    uv_cond_signal(&cond);
    uv_mutex_unlock(&mutex);
}
void CallbackWrapper::Wait() {
    uv_cond_wait(&cond, &mutex);
}

}