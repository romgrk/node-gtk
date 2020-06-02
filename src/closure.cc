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

GClosure *Closure::New(Local<Function> function, GICallableInfo* info, guint signalId) {
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

void Closure::Marshal(GClosure     *base,
                      GValue       *g_return_value,
                      uint          n_param_values,
                      const GValue *param_values,
                      gpointer      invocation_hint,
                      gpointer      marshal_data) {

    auto closure = (Closure *) base;
    auto signal_id = GPOINTER_TO_UINT(marshal_data);

    AsyncCallEnvironment* env = reinterpret_cast<AsyncCallEnvironment *>(AsyncCallEnvironment::asyncHandle.data);
    uv_thread_t thread = uv_thread_self();

    /* Case 1: same thread */
    if (uv_thread_equal(&thread, &env->mainThread)) {
        CallbackWrapper::Execute(closure->info, signal_id, closure->persistent, g_return_value, n_param_values, param_values);
        return;
    }

    /* Case 2: different thread */
    CallbackWrapper cb(closure->info, signal_id, &closure->persistent, g_return_value, n_param_values, param_values);

    uv_mutex_lock(&env->mutex);
    env->queue.push(&cb);
    uv_mutex_unlock(&env->mutex);
    uv_async_send(&AsyncCallEnvironment::asyncHandle);

    cb.Wait();
}

void Closure::Invalidated (gpointer data, GClosure *base) {
    Closure *closure = (Closure *) base;
    closure->~Closure();
}

};
