/*
 * Copyright (C) 2014 Endless Mobile
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
 * 02111-1307, USA.
 *
 * Written by:
 *     Jasper St. Pierre <jstpierre@mecheye.net>
 */

#include "function.h"
#include "value.h"
#include "gobject.h"

#include <girffi.h>

using namespace v8;

namespace GNodeJS {

struct FunctionInfo {
    GIFunctionInfo *info;
    GIFunctionInvoker invoker;
};

static void FunctionInvoker(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate();
    FunctionInfo *func = (FunctionInfo *) External::Cast (*args.Data ())->Value ();

    GIBaseInfo *info = func->info;
    GError *error = NULL;

    int n_callable_args = g_callable_info_get_n_args ((GICallableInfo *) info);
    int n_total_args = n_callable_args;
    int n_in_args = 0;

    for (int i = 0; i < n_callable_args; i++) {
        GIArgInfo arg_info;

        g_callable_info_load_arg ((GICallableInfo *) info, i, &arg_info);

        if (g_arg_info_get_direction (&arg_info) == GI_DIRECTION_IN ||
            g_arg_info_get_direction (&arg_info) == GI_DIRECTION_INOUT)
            n_in_args++;
    }

    if (args.Length() < n_in_args) {
        isolate->ThrowException (Exception::TypeError (String::NewFromUtf8 (isolate, "Not enough arguments.")));
        return;
    }

    gboolean is_method = ((g_function_info_get_flags (info) & GI_FUNCTION_IS_METHOD) != 0 &&
                          (g_function_info_get_flags (info) & GI_FUNCTION_IS_CONSTRUCTOR) == 0);
    if (is_method)
        n_total_args++;

    GIArgument total_arg_values[n_total_args];
    GIArgument *callable_arg_values;

    if (is_method) {
        total_arg_values[0].v_pointer = GObjectFromWrapper (args.This ());
        callable_arg_values = &total_arg_values[1];
    } else {
        callable_arg_values = &total_arg_values[0];
    }

    for (int i = 0; i < n_callable_args; i++) {
        GIArgInfo arg_info = {};
        g_callable_info_load_arg ((GICallableInfo *) info, i, &arg_info);
        GIDirection direction = g_arg_info_get_direction (&arg_info);

        if (direction == GI_DIRECTION_OUT) {
            if (g_arg_info_is_caller_allocates (&arg_info)) {
                assert (0);
            } else {
                callable_arg_values[i].v_pointer = NULL;
            }
        } else {
            bool may_be_null = g_arg_info_may_be_null (&arg_info);
            GITypeInfo type_info;
            g_arg_info_load_type (&arg_info, &type_info);
            V8ToGIArgument (isolate, &type_info, &callable_arg_values[i], args[i], may_be_null);
        }
    }

    void *ffi_arg_pointers[n_total_args];
    for (int i = 0; i < n_total_args; i++)
        ffi_arg_pointers[i] = &total_arg_values[i];

    GIArgument return_value;
    ffi_call (&func->invoker.cif, FFI_FN (func->invoker.native_address),
              &return_value, ffi_arg_pointers);

    for (int i = 0; i < n_callable_args; i++) {
        GIArgInfo arg_info;
        g_callable_info_load_arg ((GICallableInfo *) info, i, &arg_info);
        GIDirection direction = g_arg_info_get_direction (&arg_info);
        if (direction == GI_DIRECTION_OUT) {
            /* XXX: Process out value. */
        } else {
            GITypeInfo type_info;
            g_arg_info_load_type (&arg_info, &type_info);
            FreeGIArgument (&type_info, &callable_arg_values[i]);
        }
    }

    if (error) {
        isolate->ThrowException (Exception::TypeError (String::NewFromUtf8 (isolate, error->message)));
        return;
    }

    GITypeInfo return_value_type;
    g_callable_info_load_return_type ((GICallableInfo *) info, &return_value_type);
    args.GetReturnValue ().Set (GIArgumentToV8 (isolate, &return_value_type, &return_value));
}

static void FunctionDestroyed(const WeakCallbackData<FunctionTemplate, FunctionInfo> &data) {
    FunctionInfo *func = data.GetParameter ();
    g_base_info_unref (func->info);
    g_function_invoker_destroy (&func->invoker);
    g_free (func);
}

Handle<Function> MakeFunction(Isolate *isolate, GIBaseInfo *info) {
    FunctionInfo *func = g_new0 (FunctionInfo, 1);
    func->info = g_base_info_ref (info);

    g_function_info_prep_invoker (func->info, &func->invoker, NULL);

    Local<FunctionTemplate> tpl = FunctionTemplate::New (isolate, FunctionInvoker, External::New (isolate, func));
    Local<Function> fn = tpl->GetFunction ();

    Persistent<FunctionTemplate> persistent(isolate, tpl);
    persistent.SetWeak (func, FunctionDestroyed);

    const char *function_name = g_base_info_get_name (info);
    fn->SetName (String::NewFromUtf8 (isolate, function_name));

    return fn;
}

#if 0
class TrampolineInfo {
    ffi_cif cif;
    ffi_closure *closure;
    Persistent<Function> persistent;
    GICallableInfo *info;
    GIScopeType scope_type;

    TrampolineInfo(Handle<Function>  function,
                   GICallableInfo   *info,
                   GIScopeType       scope_type);

    void Dispose();
    static void Call(ffi_cif *cif, void *result, void **args, void *data);
    void *GetClosure();
};

void TrampolineInfo::Dispose() {
    persistent = nullptr;
    g_base_info_unref (info);
    g_callable_info_free_closure (info, closure);
};

void TrampolineInfo::Call(ffi_cif *cif,
                          void *result,
                          void **args,
                          void *data) {
    TrampolineInfo *trampoline = (TrampolineInfo *) data;

    int argc = g_callable_info_get_n_args (trampoline->info);
    Handle<Value> argv[argc];

    for (int i = 0; i < argc; i++) {
        GIArgInfo arg_info;
        g_callable_info_load_arg (trampoline->info, i, &arg_info);
        GITypeInfo type_info;
        g_arg_info_load_type (&arg_info, &type_info);
        argv[i] = GIArgumentToV8 (&type_info, (GIArgument *) &args[i]);
    }

    Handle<Function> func = trampoline->func;
    /* Provide a bogus "this" function. Any interested callers should
     * bind their callbacks to what they're intersted in... */
    Handle<Object> this_obj = func;
    Handle<Value> return_value = func->Call (this_obj, argc, argv);
    GITypeInfo type_info;
    g_callable_info_load_return_type (trampoline->info, &type_info);
    V8ToGIArgument (&type_info, (GIArgument *) &result, return_value,
                    g_callable_info_may_return_null (trampoline->info));
}

TrampolineInfo::TrampolineInfo(Handle<Function>  function,
                               GICallableInfo   *info,
                               GIScopeType       scope_type) {
    this->closure = g_callable_info_prepare_closure (info, &cif, Call, this);
    this->func = Persistent<Function>::New (function);
    this->info = g_base_info_ref (info);
    this->scope_type = scope_type;
}
#endif

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

    Handle<Value> argv[argc];

    for (uint i = 0; i < argc; i++)
        argv[i] = GValueToV8 (isolate, &g_argv[i]);

    Handle<Object> this_obj = func;
    Handle<Value> return_value = func->Call (this_obj, argc, argv);

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
