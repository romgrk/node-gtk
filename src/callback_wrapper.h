
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

using v8::Function;
using v8::Local;

namespace GNodeJS {

struct CallbackWrapper {
    CallbackWrapper(GICallableInfo *info, guint signal_id,
                    const Nan::Persistent<v8::Function> *persistent,
                    GValue *returnValue, uint nValues,
                    const GValue *values);
    ~CallbackWrapper();
    static void Execute(GICallableInfo *info, guint signal_id,
                        const Nan::Persistent<v8::Function> &persFn,
                        GValue *returnValue, uint nValues,
                        const GValue *values);
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

};
