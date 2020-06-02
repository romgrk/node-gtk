#include "async_call_wrapper.h"

using v8::Object;
using v8::Value;

namespace GNodeJS {

AsyncCallWrapper::AsyncCallWrapper(std::function<void()>& fn): fn(fn) {
    uv_mutex_init(&mutex);
    uv_mutex_lock(&mutex);
    uv_cond_init(&cond);
}

AsyncCallWrapper::~AsyncCallWrapper() {
    uv_mutex_unlock(&mutex);
    uv_cond_destroy(&cond);
    uv_mutex_destroy(&mutex);
}


void AsyncCallWrapper::Execute() {
    fn();
    Done();
}

void AsyncCallWrapper::Done() {
    uv_mutex_lock(&mutex);
    uv_cond_signal(&cond);
    uv_mutex_unlock(&mutex);
}
void AsyncCallWrapper::Wait() {
    uv_cond_wait(&cond, &mutex);
}

}