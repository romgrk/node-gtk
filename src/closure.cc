#include <glib.h>
#include "nan.h"
#include "function.h"
#include "type.h"
#include "value.h"

using namespace v8;

namespace GNodeJS {

struct Closure {
    GClosure base;
    Persistent<Function> persistent;
    GISignalInfo* info;

    ~Closure() {
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

void Closure::Marshal(GClosure *base,
                      GValue   *g_return_value,
                      uint argc, const GValue *g_argv,
                      gpointer  invocation_hint,
                      gpointer  marshal_data) {
    Closure *closure = (Closure *) base;
    Isolate *isolate = Isolate::GetCurrent ();

    HandleScope scope(isolate);
    Local<Context> context = Context::New(isolate);
    Context::Scope context_scope(context);

    TryCatch try_catch(isolate);

    Local<Function> func = Local<Function>::New(isolate, closure->persistent);

    // We don't pass the implicit instance as first argument
    uint n_js_args = argc - 1;

    #ifndef __linux__
        Local<Value>* js_args = new Local<Value>[n_js_args];
    #else
        Local<Value> js_args[n_js_args];
    #endif

    for (uint i = 1; i < argc; i++) {
        GIArgument argument;
        memcpy(&argument, &g_argv[i].data[0], sizeof(GIArgument));
        GIArgInfo arg_info;
        GITypeInfo type_info;
        g_callable_info_load_arg(closure->info, i - 1, &arg_info);
        g_arg_info_load_type(&arg_info, &type_info);

        js_args[i - 1] = GIArgumentToV8(&type_info, &argument);
    }

    Local<Object> self = func;
    Local<Value> return_value;

    if (!func->Call(context, self, n_js_args, js_args).ToLocal(&return_value)) {
        g_warning ("Marshal: caught: %s", *Nan::Utf8String(try_catch.Exception()));
    } else if (g_return_value) {
        if (G_VALUE_TYPE(g_return_value) == G_TYPE_INVALID)
            g_warning ("Marshal: return value has invalid g_type");
        else if (!V8ToGValue (g_return_value, return_value))
            g_warning ("Marshal: could not convert return value");
    }

    #ifndef __linux__
        delete[] js_args;
    #endif
}

void Closure::Invalidated(gpointer data, GClosure *base) {
    Closure *closure = (Closure *) base;
    closure->~Closure();
}

GClosure *MakeClosure(Isolate *isolate, Local<Function> function, GISignalInfo* info) {
    Closure *closure = (Closure *) g_closure_new_simple (sizeof (*closure), NULL);
    closure->persistent.Reset(isolate, function);
    closure->info = info;
    GClosure *gclosure = &closure->base;
    g_closure_set_marshal (gclosure, Closure::Marshal);
    g_closure_add_invalidate_notifier (gclosure, NULL, Closure::Invalidated);
    return gclosure;
}

};
