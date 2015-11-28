/*
 * Copyright (C) 2015 Endless Mobile
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
