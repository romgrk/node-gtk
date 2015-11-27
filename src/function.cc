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

static Handle<Value> FunctionInvoker(const Arguments &args) {
    HandleScope scope;
    FunctionInfo *func = (FunctionInfo *) External::Unwrap (args.Data ());

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
        ThrowException (Exception::TypeError (String::New ("Not enough arguments.")));
        return scope.Close (Undefined ());
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
            V8ToGIArgument (&type_info, &callable_arg_values[i], args[i], may_be_null);
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
        ThrowException (Exception::TypeError (String::New (error->message)));
        return scope.Close (Undefined ());
    }

    GITypeInfo return_value_type;
    g_callable_info_load_return_type ((GICallableInfo *) info, &return_value_type);
    return scope.Close (GIArgumentToV8 (&return_value_type, &return_value));
}

static void FunctionDestroyed(Persistent<Value> object, void *data) {
    FunctionInfo *func = (FunctionInfo *) data;
    g_base_info_unref (func->info);
    g_function_invoker_destroy(&func->invoker);
    g_free (func);
}

Handle<Function> MakeFunction(GIBaseInfo *info) {
    FunctionInfo *func = g_new0 (FunctionInfo, 1);
    func->info = g_base_info_ref (info);

    g_function_info_prep_invoker (func->info, &func->invoker, NULL);

    Persistent<FunctionTemplate> tpl = Persistent<FunctionTemplate>::New (FunctionTemplate::New (FunctionInvoker, External::Wrap (func)));
    tpl.MakeWeak (func, FunctionDestroyed);
    Local<Function> fn = tpl->GetFunction ();

    const char *function_name = g_base_info_get_name (info);
    fn->SetName (String::NewSymbol (function_name));

    return fn;
}

};
