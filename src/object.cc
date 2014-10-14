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

#include "object.h"
#include "function.h"
#include "value.h"

using namespace v8;

namespace GNodeJS {

static bool InitGParameterFromProperty(GParameter    *parameter,
                                       void          *klass,
                                       Handle<String> name,
                                       Handle<Value>  value)
{
    String::Utf8Value name_str (name);
    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_CLASS (klass), *name_str);
    if (pspec == NULL)
        return false;

    parameter->name = pspec->name;
    g_value_init (&parameter->value, G_PARAM_SPEC_VALUE_TYPE (pspec));
    V8ToGValue (&parameter->value, value);
    return true;
}

static bool InitGParametersFromProperty(GParameter    **parameters_p,
                                        int            *n_parameters_p,
                                        void           *klass,
                                        Handle<Object>  property_hash)
{
    Local<Array> properties = property_hash->GetOwnPropertyNames ();
    int n_parameters = properties->Length();
    GParameter *parameters = g_new0 (GParameter, n_parameters);

    for (int i = 0; i < n_parameters; i++) {
        Local<Value> name = properties->Get (i);
        Local<Value> value = property_hash->Get (name);

        if (!InitGParameterFromProperty (&parameters[i], klass, name->ToString (), value))
            return false;
    }

    *parameters_p = parameters;
    *n_parameters_p = n_parameters;
    return true;
}

static void ToggleNotify(gpointer user_data, GObject *gobject, gboolean toggle_down);

G_DEFINE_QUARK(gnode_js_object, gnode_js_object);

static Handle<Value> GObjectConstructor(const Arguments &args) {
    HandleScope scope;

    /* The flow of this function is a bit twisty.

     * There's two cases for when this code is called:
     * user code doing `new Gtk.Widget({ ... })`, and
     * internal code as part of WrapperFromGObject, where
     * the constructor is called with one external. This
     * is even sillier as the normal user code case actually
     * calls WrapperFromGObject, meaning this function is
     * re-entrant in that case. */

    if (!args.IsConstructCall ()) {
        ThrowException (Exception::TypeError (String::New ("Not a construct call.")));
        return scope.Close (Undefined ());
    }

    if (args[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromGObject is called. */

        Handle<Object> self = args.This ();

        void *data = External::Unwrap (args[0]);
        GObject *gobject = G_OBJECT (data);
        self->SetPointerInInternalField (0, gobject);

        g_object_ref_sink (gobject);
        g_object_add_toggle_ref (gobject, ToggleNotify, NULL);

        Object *self_p = *self;
        g_object_set_qdata (gobject, gnode_js_object_quark (), self_p);

        return self;
    } else {
        /* User code calling `new Gtk.Widget({ ... })` */

        GObject *obj = NULL;
        GIBaseInfo *info = (GIBaseInfo *) External::Unwrap(args.Data ());
        GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);
        void *klass = g_type_class_ref (gtype);

        GParameter *parameters = NULL;
        int n_parameters = 0;

        if (args[0]->IsObject ()) {
            Local<Object> property_hash = args[0]->ToObject ();

            if (!InitGParametersFromProperty (&parameters, &n_parameters, klass, property_hash)) {
                ThrowException (Exception::TypeError (String::New ("Unable to make GParameters.")));
                goto out;
            }
        }

        obj = (GObject *) g_object_newv (gtype, n_parameters, parameters);

    out:
        g_free (parameters);
        g_type_class_unref (klass);

        if (obj)
            return scope.Close (WrapperFromGObject (obj));
        else
            return scope.Close (Null ());
    }
}

G_DEFINE_QUARK(gnode_js_template, gnode_js_template);

static void ClassDestroyed(Persistent<Value> object, void *data) {
    GIBaseInfo *info = (GIBaseInfo *) data;
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);
    g_type_set_qdata (gtype, gnode_js_template_quark (), NULL);
    g_base_info_unref (info);
}

static void DefineConstructorMethods(Handle<Object> constructor, GIBaseInfo *info) {
    int n_methods = g_object_info_get_n_methods (info);
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *meth_info = g_object_info_get_method (info, i);
        GIFunctionInfoFlags flags = g_function_info_get_flags (meth_info);

        if (!(flags & GI_FUNCTION_IS_METHOD)) {
            const char *function_name = g_base_info_get_name ((GIBaseInfo *) meth_info);
            Handle<Function> fn = MakeFunction (meth_info);
            constructor->Set (String::NewSymbol (function_name), fn);
        }

        g_base_info_unref ((GIBaseInfo *) meth_info);
    }
}

static void DefinePrototypeMethods(Handle<ObjectTemplate> prototype, GIBaseInfo *info) {
    int n_methods = g_object_info_get_n_methods (info);
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *meth_info = g_object_info_get_method (info, i);
        GIFunctionInfoFlags flags = g_function_info_get_flags (meth_info);

        if (flags & GI_FUNCTION_IS_METHOD) {
            const char *function_name = g_base_info_get_name ((GIBaseInfo *) meth_info);
            Handle<Function> fn = MakeFunction (meth_info);
            prototype->Set (String::NewSymbol (function_name), fn);
        }

        g_base_info_unref ((GIBaseInfo *) meth_info);
    }
}

static Handle<FunctionTemplate> GetClassTemplateFromGI(GIBaseInfo *info);

static Handle<FunctionTemplate> GetClassTemplate(GIBaseInfo *info, GType gtype) {
    void *data = g_type_get_qdata (gtype, gnode_js_template_quark ());
    if (data) {
        FunctionTemplate *tpl_p = (FunctionTemplate *) data;
        Persistent<FunctionTemplate> tpl(tpl_p);
        return tpl;
    } else {
        Persistent<FunctionTemplate> tpl = Persistent<FunctionTemplate>::New (FunctionTemplate::New (GObjectConstructor, External::Wrap (info)));
        tpl.MakeWeak (g_base_info_ref (info), ClassDestroyed);

        const char *class_name = g_base_info_get_name (info);
        tpl->SetClassName (String::NewSymbol (class_name));

        FunctionTemplate *tpl_p = *tpl;
        g_type_set_qdata (gtype, gnode_js_template_quark (), tpl_p);

        GIObjectInfo *parent_info = g_object_info_get_parent (info);
        if (parent_info) {
            Handle<FunctionTemplate> parent_tpl = GetClassTemplateFromGI ((GIBaseInfo *) parent_info);
            tpl->Inherit (parent_tpl);
        }

        DefineConstructorMethods (tpl->GetFunction (), info);
        DefinePrototypeMethods (tpl->InstanceTemplate (), info);

        Handle<ObjectTemplate> inst_tpl = tpl->InstanceTemplate ();
        inst_tpl->SetInternalFieldCount (1);

        return tpl;
    }
}

static Handle<FunctionTemplate> GetClassTemplateFromGI(GIBaseInfo *info) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);
    return GetClassTemplate (info, gtype);
}

static Handle<FunctionTemplate> GetClassTemplateFromGType(GType gtype) {
    GIRepository *repo = g_irepository_get_default ();
    GIBaseInfo *info = g_irepository_find_by_gtype (repo, gtype);
    return GetClassTemplate (info, gtype);
}

Handle<Function> MakeClass(GIBaseInfo *info) {
    Handle<FunctionTemplate> tpl = GetClassTemplateFromGI (info);
    return tpl->GetFunction ();
}

static void ObjectDestroyed(Persistent<Value> object, void *data) {
    GObject *gobject = G_OBJECT (data);

    /* We're destroying the wrapper object, so make sure to clear out
     * the qdata that points back to us. */
    g_object_set_qdata (gobject, gnode_js_object_quark (), NULL);

    g_object_unref (gobject);
}

static void ToggleNotify(gpointer user_data, GObject *gobject, gboolean toggle_down) {
    void *data = g_object_get_qdata (gobject, gnode_js_object_quark ());
    assert (data != NULL);
    Object *obj_p = (Object *) data;
    Persistent<Object> obj(obj_p);

    if (toggle_down) {
        /* We're dropping from 2 refs to 1 ref. We are the last holder. Make
         * sure that that our weak ref is installed. */
        obj.MakeWeak (gobject, ObjectDestroyed);
    } else {
        /* We're going from 1 ref to 2 refs. We can't let our wrapper be
         * collected, so make sure that our reference is persistent */
        obj.ClearWeak ();
    }
}

Handle<Value> WrapperFromGObject(GObject *gobject) {
    void *data = g_object_get_qdata (gobject, gnode_js_object_quark ());

    /* Easy case: we already have a wrapper. */
    if (data) {
        Object *obj_p = (Object *) data;
        Persistent<Object> obj(obj_p);
        return obj;
    } else {
        GType gtype = G_OBJECT_TYPE (gobject);

        Handle<FunctionTemplate> tpl = GetClassTemplateFromGType (gtype);
        Handle<Function> constructor = tpl->GetFunction ();

        Handle<Value> gobject_external = External::New (gobject);
        Handle<Value> args[] = { gobject_external };
        Local<Object> obj_local = constructor->NewInstance (1, args);
        Persistent<Object> obj = Persistent<Object>::New (obj_local);
        return obj;
    }
}

GObject * GObjectFromWrapper(Handle<Value> value) {
    Handle<Object> object = value->ToObject ();
    void *data = object->GetPointerFromInternalField (0);
    GObject *gobject = G_OBJECT (data);
    return gobject;
}

};
