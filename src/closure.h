
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

    ~Closure() {
        persistent.Reset();
        g_base_info_unref (info);
    }

    static GClosure *New(Local<Function> function,
                         GICallableInfo* info,
                         guint signalId);

    static void Marshal(GClosure *closure,
                        GValue   *g_return_value,
                        uint argc, const GValue *g_argv,
                        gpointer  invocation_hint,
                        gpointer  marshal_data);

    static void Invalidated(gpointer data, GClosure *closure);
};

};
