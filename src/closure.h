
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
    /* The handler function is NOT held here. It lives in a JS array on the
     * wrapper object (reachable only through the wrapper), and we keep just its
     * index. This breaks the wrapper <-> handler reference loop that a strong
     * Nan::Persistent used to create and leak (#375); see
     * doc/signal-handler-gc.md. */
    guint handlerIndex;
    GICallableInfo* info;

    ~Closure() {
        if (info) g_base_info_unref (info);
    }

    static GClosure *New(guint handlerIndex,
                         GICallableInfo* info,
                         guint signalId);

    static void Execute(GICallableInfo *info, guint signal_id,
                        GObject *instance, guint handlerIndex,
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
