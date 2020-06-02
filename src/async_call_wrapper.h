
#pragma once

#include <functional>
#include <node.h>
#include <nan.h>

using v8::Function;
using v8::Local;

namespace GNodeJS {

struct AsyncCallWrapper {
    AsyncCallWrapper(std::function<void()>& fn);
    ~AsyncCallWrapper();
    void Execute();
    void Done();
    void Wait();
private:
    std::function<void()> fn;
    uv_cond_t cond;
    uv_mutex_t mutex;
};

};
