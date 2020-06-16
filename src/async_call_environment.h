
#pragma once

#include <functional>
#include <node.h>
#include <nan.h>
#include "async_call_wrapper.h"

namespace GNodeJS {

struct AsyncCallEnvironment {
    static uv_async_t asyncHandle;
    uv_thread_t mainThread;
    uv_mutex_t mutex;
    std::queue<AsyncCallWrapper *> queue;

    static void Initialize();
    static void QueueHandler(uv_async_t* asyncHandle);
    bool IsSameThread() const;
    void Call(std::function<void()> fn);
};

};
