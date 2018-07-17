
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

using v8::Function;
using v8::Persistent;

namespace GNodeJS {

struct Closure {
    GClosure base;
    Persistent<Function> persistent;
    GIBaseInfo* info;

    ~Closure() {
        persistent.Reset();
        if (info)
            g_base_info_unref(info);
    }

    static void Marshal(GClosure *closure,
                        GValue   *g_return_value,
                        uint argc, const GValue *g_argv,
                        gpointer  invocation_hint,
                        gpointer  marshal_data);

    static void Invalidated(gpointer data, GClosure *closure);
};

GClosure *MakeClosure(v8::Isolate *isolate, v8::Handle<v8::Function> function, GISignalInfo* info);

};
