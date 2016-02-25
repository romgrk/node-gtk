
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
    /* XXX: Any other way to get this? */
    Isolate *isolate = Isolate::GetCurrent ();
    HandleScope scope(isolate);

    Closure *closure = (Closure *) base;
    Handle<Function> func = Handle<Function>::New(isolate, closure->persistent);

    #ifndef __linux__
        Handle<Value>* argv = new Handle<Value>[argc];
    #else
        Handle<Value> argv[argc];
    #endif

    for (uint i = 0; i < argc; i++)
        argv[i] = GValueToV8 (isolate, &g_argv[i]);

    Handle<Object> this_obj = func;
    Handle<Value> return_value = func->Call (this_obj, argc, argv);

    #ifndef __linux__
        delete[] argv;
    #endif

    if (g_return_value)
        V8ToGValue (g_return_value, return_value);
}

void Closure::Invalidated(gpointer data, GClosure *base) {
    Closure *closure = (Closure *) base;
    closure->~Closure();
}

GClosure *MakeClosure(Isolate *isolate, Handle<Function> function) {
    Closure *closure = (Closure *) g_closure_new_simple (sizeof (*closure), NULL);
    closure->persistent.Reset(isolate, function);
    GClosure *gclosure = &closure->base;
    g_closure_set_marshal (gclosure, Closure::Marshal);
    g_closure_add_invalidate_notifier (gclosure, NULL, Closure::Invalidated);
    return gclosure;
}

};
