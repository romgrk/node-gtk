#include "async_call_environment.h"

namespace GNodeJS {

// locking and signalling adapted from https://github.com/node-ffi-napi/node-ffi-napi
uv_async_t AsyncCallEnvironment::asyncHandle;

void AsyncCallEnvironment::Initialize() {
    AsyncCallEnvironment* env = new AsyncCallEnvironment();
    asyncHandle.data = env;
    env->mainThread = uv_thread_self();
    uv_loop_t* loop = uv_default_loop();
    uv_async_init(loop, &asyncHandle, QueueHandler);
    uv_mutex_init(&env->mutex);
    uv_unref(reinterpret_cast<uv_handle_t *>(&asyncHandle));
    uv_async_send(&asyncHandle);
}

void AsyncCallEnvironment::QueueHandler(uv_async_t* handle) {
    AsyncCallEnvironment* data = reinterpret_cast<AsyncCallEnvironment *>(handle->data);
    uv_mutex_lock(&data->mutex);

    while (!data->queue.empty()) {
        CallbackWrapper* cb = data->queue.front();
        cb->Execute();
        data->queue.pop();
    }

    uv_mutex_unlock(&data->mutex);
}

}