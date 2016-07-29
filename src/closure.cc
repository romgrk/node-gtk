#include <glib.h>
#include "nan.h"
#include "function.h"
#include "value.h"

using namespace v8;

namespace GNodeJS {

struct Closure {
    GClosure base;
    Persistent<Function> persistent;

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

    #ifndef __linux__
        Local<Value>* argv = new Local<Value>[argc];
    #else
        Local<Value> argv[argc];
    #endif

    for (uint i = 0; i < argc; i++)
        argv[i] = GValueToV8(&g_argv[i]);

    Local<Object> this_obj = func;
    Local<Value> return_value;

    if (!func->Call(context, this_obj, argc, argv).ToLocal(&return_value)) {
        g_warning("Caught: %s", *String::Utf8Value(try_catch.Exception()));
    } else if (g_return_value) {
        V8ToGValue (g_return_value, return_value);
    }

    #ifndef __linux__
        delete[] argv;
    #endif
}

void Closure::Invalidated(gpointer data, GClosure *base) {
    Closure *closure = (Closure *) base;
    closure->~Closure();
}

GClosure *MakeClosure(Isolate *isolate, Local<Function> function) {
    Closure *closure = (Closure *) g_closure_new_simple (sizeof (*closure), NULL);
    closure->persistent.Reset(isolate, function);
    GClosure *gclosure = &closure->base;
    g_closure_set_marshal (gclosure, Closure::Marshal);
    g_closure_add_invalidate_notifier (gclosure, NULL, Closure::Invalidated);
    return gclosure;
}

};
