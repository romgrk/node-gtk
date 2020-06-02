
#pragma once

#include <node.h>
#include <nan.h>
#include "callback_wrapper.h"

namespace GNodeJS {

struct AsyncCallEnvironment {
    static uv_async_t asyncHandle;
    uv_thread_t mainThread;
    uv_mutex_t mutex;
    std::queue<CallbackWrapper *> queue;

    static void Initialize();
    static void QueueHandler(uv_async_t* asyncHandle);
};

};
