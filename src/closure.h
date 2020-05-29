
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>
#include <ffi.h>
#include <girffi.h>

using v8::Function;
using v8::Local;

namespace GNodeJS {

struct Closure {
    GClosure base;
    Nan::Persistent<v8::Function> persistent;
    GICallableInfo* info;
    static uv_async_t asyncHandle;

    ~Closure() {
        persistent.Reset();
    }

    static void Initialize();
    static GClosure *New(Local<Function> function, GICallableInfo *info,
                         guint signalId);
    static void Execute(GICallableInfo *info, guint signal_id,
                        const Nan::Persistent<v8::Function> &persFn,
                        GValue *returnValue, uint nValues,
                        const GValue *values);
    static void Marshal(GClosure *closure,
                        GValue   *g_return_value,
                        uint argc, const GValue *g_argv,
                        gpointer  invocation_hint,
                        gpointer  marshal_data);
    static void Invalidated(gpointer data, GClosure *closure);
    static void QueueHandler(uv_async_t* asyncHandle);
};

struct CallbackWrapper {
    CallbackWrapper(GICallableInfo *info, guint signal_id,
                    const Nan::Persistent<v8::Function> *persistent,
                    GValue *returnValue, uint nValues,
                    const GValue *values);
    ~CallbackWrapper();
    void Execute();
    void Done();
    void Wait();
private:
    GICallableInfo *info;
    guint signal_id;
    const Nan::Persistent<v8::Function>* persistent;
    GValue* returnValue;
    GValue* values;
    uint nValues;

    uv_cond_t cond;
    uv_mutex_t mutex;
};

struct AsyncCallEnvironment {
    uv_thread_t mainThread;
    uv_mutex_t mutex;
    std::queue<CallbackWrapper *> queue;
};
};
