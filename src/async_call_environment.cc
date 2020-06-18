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
        auto& cb = data->queue.front();
        cb->Execute();
        data->queue.pop();
    }

    uv_mutex_unlock(&data->mutex);
}

bool AsyncCallEnvironment::IsSameThread() const {
    uv_thread_t thread = uv_thread_self();
    return uv_thread_equal(&thread, &mainThread);
}

void AsyncCallEnvironment::Call(std::function<void()> fn) {
    AsyncCallWrapper fnWrapper(fn);
    uv_mutex_lock(&mutex);
    queue.push(&fnWrapper);
    uv_mutex_unlock(&mutex);
    uv_async_send(&AsyncCallEnvironment::asyncHandle);
    fnWrapper.Wait();
}

}