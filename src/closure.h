
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>
#include <ffi.h>
#include <girffi.h>
#include "async_call_environment.h"

using v8::Function;
using v8::Local;

namespace GNodeJS {

struct Closure {
    GClosure base;
    v8::TracedReference<v8::Function> functionRef;
    GICallableInfo* info;

    ~Closure() {
        functionRef.Reset();
        if (info) g_base_info_unref (info);
    }

    static GClosure *New(Local<Function> function,
                         GICallableInfo* info,
                         guint signalId);

    static void Execute(GICallableInfo *info, guint signal_id,
                        const v8::TracedReference<v8::Function> &persFn,
                        GValue *g_return_value, guint n_param_values,
                        const GValue *param_values);

    static void Marshal(GClosure *closure,
                        GValue   *g_return_value,
                        guint argc, const GValue *g_argv,
                        gpointer  invocation_hint,
                        gpointer  marshal_data);

    static void Invalidated(gpointer data, GClosure *closure);
};

};
