
#include "boxed.h"
#include "debug.h"
#include "function.h"
#include "closure.h"
#include "gi.h"
#include "gobject.h"
#include "util.h"
#include "value.h"

using namespace v8;

namespace GNodeJS {

static G_DEFINE_QUARK(gnode_js_object, gnode_js_object);
static G_DEFINE_QUARK(gnode_js_template, gnode_js_template);

static bool InitGParameterFromProperty(GParameter    *parameter,
                                       void          *klass,
                                       Handle<String> name,
                                       Handle<Value>  value) {
    // XXX js->c name conversion
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
                                        Handle<Object>  property_hash) {
    Local<Array> properties = property_hash->GetOwnPropertyNames ();
    int n_parameters = properties->Length ();
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

static void AssociateGObject(Isolate *isolate, Handle<Object> object, GObject *gobject) {
    object->SetAlignedPointerInInternalField (0, gobject);

    g_object_ref_sink (gobject);
    g_object_add_toggle_ref (gobject, ToggleNotify, NULL);

    Persistent<Object> *persistent = new Persistent<Object>(isolate, object);
    g_object_set_qdata (gobject, gnode_js_object_quark (), persistent);
}

static void GObjectConstructor(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate ();

    /* The flow of this function is a bit twisty.

     * There's two cases for when this code is called:
     * user code doing `new Gtk.Widget({ ... })`, and
     * internal code as part of WrapperFromGObject, where
     * the constructor is called with one external. */

    if (!args.IsConstructCall ()) {
        Nan::ThrowTypeError("Not a construct call.");
        return;
    }

    Handle<Object> self = args.This ();

    if (args[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromGObject is called. */

        void *data = External::Cast (*args[0])->Value ();
        GObject *gobject = G_OBJECT (data);

        AssociateGObject (isolate, self, gobject);
    } else {
        /* User code calling `new Gtk.Widget({ ... })` */

        GObject *gobject;
        GIBaseInfo *info = (GIBaseInfo *) External::Cast (*args.Data ())->Value ();
        GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);
        void *klass = g_type_class_ref (gtype);

        GParameter *parameters = NULL;
        int n_parameters = 0;

        if (args[0]->IsObject ()) {
            Local<Object> property_hash = args[0]->ToObject ();

            if (!InitGParametersFromProperty (&parameters, &n_parameters, klass, property_hash)) {
                Nan::ThrowError("GObjectConstructor: Unable to make GParameters.");
                goto out;
            }
        }

        gobject = (GObject *) g_object_newv (gtype, n_parameters, parameters);
        AssociateGObject (isolate, self, gobject);

    out:
        g_free (parameters);
        g_type_class_unref (klass);
    }
}

static void SignalConnectInternal(const Nan::FunctionCallbackInfo<v8::Value> &args, bool after) {
    Isolate *isolate = args.GetIsolate ();
    GObject *gobject = GObjectFromWrapper (args.This ());

    String::Utf8Value signal_name (args[0]->ToString ());
    Handle<Function> callback = Local<Function>::Cast (args[1]->ToObject ());
    GClosure *gclosure = MakeClosure (isolate, callback);

    // TODO return some sort of cancellation handle?
    ulong handler_id = g_signal_connect_closure (gobject, *signal_name, gclosure, after);
    args.GetReturnValue ().Set(Integer::NewFromUnsigned (isolate, handler_id));
}

NAN_METHOD(SignalConnect) {
    SignalConnectInternal(info, false);
}

NAN_METHOD(ObjectPropertyGetter) {
    Isolate *isolate = info.GetIsolate ();
    GObject *gobject = GNodeJS::GObjectFromWrapper (info[0]);
    String::Utf8Value prop_name_v (info[1]->ToString ());
    const char *prop_name = *prop_name_v;

    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);
    GValue value = {};
    g_value_init (&value, G_PARAM_SPEC_VALUE_TYPE (pspec));

    g_object_get_property (gobject, prop_name, &value);

    info.GetReturnValue().Set(GNodeJS::GValueToV8 (isolate, &value));
}

NAN_METHOD(ObjectPropertySetter) {
    GObject *gobject = GNodeJS::GObjectFromWrapper(info[0]);
    String::Utf8Value prop_name_v (info[1]->ToString ());
    const char *prop_name = *prop_name_v;

    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);
    GValue value = {};
    g_value_init (&value, G_PARAM_SPEC_VALUE_TYPE (pspec));

    GNodeJS::V8ToGValue (&value, info[2]);

    g_object_set_property (gobject, prop_name, &value);
}

static Handle<FunctionTemplate> GetBaseClassTemplate(Isolate *isolate) {
    Local<FunctionTemplate> tpl = FunctionTemplate::New (isolate);
    Nan::SetPrototypeMethod(tpl, "on", SignalConnect);
    Nan::SetPrototypeMethod(tpl, "connect", SignalConnect);
    Nan::SetPrototypeMethod(tpl, "addEventListener", SignalConnect);
    return tpl;
}

static Handle<FunctionTemplate> GetClassTemplateFromGI(Isolate *isolate, GIBaseInfo *info);

static void ClassDestroyed(const WeakCallbackData<FunctionTemplate, GIBaseInfo> &data) {
    GIBaseInfo *info = data.GetParameter ();
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);

    void *type_data = g_type_get_qdata (gtype, gnode_js_template_quark ());
    assert (type_data != NULL);
    Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) type_data;
    delete persistent;

    g_type_set_qdata (gtype, gnode_js_template_quark (), NULL);
    g_base_info_unref (info);
}

static Handle<FunctionTemplate> GetClassTemplate(Isolate *isolate, GIBaseInfo *info, GType gtype) {
    void *data = g_type_get_qdata (gtype, gnode_js_template_quark ());

    if (data) {
        Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) data;
        Handle<FunctionTemplate> tpl = Handle<FunctionTemplate>::New (isolate, *persistent);
        return tpl;
    } else {
        //const char *class_name = g_base_info_get_name (info);
        const char *class_name = g_type_name (gtype);
        if (G_TYPE_IS_INTERFACE(gtype)) {
            WARN("GetClassTemplate: GTypeInterface: %s", g_type_name(gtype));
        }

        Handle<FunctionTemplate> tpl = FunctionTemplate::New (isolate, GObjectConstructor, External::New (isolate, info));
        tpl->SetClassName(UTF8(class_name));
        tpl->InstanceTemplate()->SetInternalFieldCount(1);

        /*tpl->PrototypeTemplate()->Set(UTF8("__signals__"), Nan::New<Object>()));
        int n_signals = g_object_info_get_n_signals(info);
        for (int i = 0; i < n_signals; i++) { }
        */

        GIObjectInfo *parent_info = g_object_info_get_parent (info);
        if (parent_info) {
            Handle<FunctionTemplate> parent_tpl = GetClassTemplateFromGI (isolate, (GIBaseInfo *) parent_info);
            tpl->Inherit(parent_tpl);
        } else {
            tpl->Inherit(GetBaseClassTemplate (isolate));
        }

        int n_methods = g_object_info_get_n_methods(info);
        for (int i = 0; i < n_methods; ++i) {
            GIFunctionInfo *fn_info = g_object_info_get_method(info, i);
            InstallFunction(isolate, tpl, fn_info);
            g_base_info_unref(fn_info);
        }

        int n_properties = g_object_info_get_n_properties(info);
        for (int i = 0; i < n_properties; ++i) {
            GIPropertyInfo *prop_info = g_object_info_get_property(info, i);
            //const char *prop_name = g_base_info_get_name(prop_info);
            //tpl->Set(UTF8("__prop"))
            //Nan::SetAccessor(tpl->PrototypeTemplate(), Nan::New<String>(prop_name),
                    //Nan::FunctionCallback(ObjectPropertyGetter),
                    //Nan::FunctionCallback(ObjectPropertySetter)
                    //));
            g_base_info_unref(prop_info);
        }

        Persistent<FunctionTemplate> *persistent = new Persistent<FunctionTemplate>(isolate, tpl);
        persistent->SetWeak (g_base_info_ref (info), ClassDestroyed);
        g_type_set_qdata(gtype, gnode_js_template_quark (), persistent);

        return tpl;
    }
}

static Handle<FunctionTemplate> GetClassTemplateFromGI(Isolate *isolate, GIBaseInfo *info) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);
    return GetClassTemplate (isolate, info, gtype);
}

static Handle<FunctionTemplate> GetClassTemplateFromGType(Isolate *isolate, GType gtype) {
    GIBaseInfo *info = g_irepository_find_by_gtype(NULL, gtype);
    while (info == NULL) {
        gtype = g_type_parent(gtype);
        info = g_irepository_find_by_gtype(NULL, gtype);
    }
    return GetClassTemplate (isolate, info, gtype);
}

Handle<Function> MakeClass(Isolate *isolate, GIBaseInfo *info) {
    Handle<FunctionTemplate> tpl = GetClassTemplateFromGI (isolate, info);
    return tpl->GetFunction ();
}

static void ObjectDestroyed(const WeakCallbackData<Object, GObject> &data) {
    GObject *gobject = data.GetParameter ();

    void *type_data = g_object_get_qdata (gobject, gnode_js_object_quark ());
    assert (type_data != NULL);
    Persistent<Object> *persistent = (Persistent<Object> *) type_data;
    delete persistent;

    /* We're destroying the wrapper object, so make sure to clear out
     * the qdata that points back to us. */
    g_object_set_qdata (gobject, gnode_js_object_quark (), NULL);

    g_object_unref (gobject);
}

static void ToggleNotify(gpointer user_data, GObject *gobject, gboolean toggle_down) {
    void *data = g_object_get_qdata (gobject, gnode_js_object_quark ());
    assert (data != NULL);

    Persistent<Object> *persistent = (Persistent<Object> *) data;

    if (toggle_down) {
        /* We're dropping from 2 refs to 1 ref. We are the last holder. Make
         * sure that that our weak ref is installed. */
        persistent->SetWeak (gobject, ObjectDestroyed);
    } else {
        /* We're going from 1 ref to 2 refs. We can't let our wrapper be
         * collected, so make sure that our reference is persistent */
        persistent->ClearWeak ();
    }
}

void InstallFunction (Isolate *isolate, Handle<FunctionTemplate> tpl, GIFunctionInfo *func_info) {
    GIFunctionInfoFlags flags = g_function_info_get_flags(func_info);
    const char *func_name = g_base_info_get_name(func_info);
    char *camel_name = Util::toCamelCase(func_name);

    Local<Function> fn = MakeFunction(isolate, func_info);

    if ((flags & GI_FUNCTION_IS_METHOD) &&
            !(flags & GI_FUNCTION_IS_CONSTRUCTOR)) {
        tpl->PrototypeTemplate()->Set(UTF8(func_name), fn);
        tpl->PrototypeTemplate()->Set(UTF8(camel_name), fn);

    } else {
        tpl->Set(UTF8(func_name), fn);
        tpl->Set(UTF8(camel_name), fn);
    }
    if ((flags & GI_FUNCTION_IS_GETTER) || (flags & GI_FUNCTION_IS_SETTER)) {
        print_info(func_info);
    }

    g_free(camel_name);
}


Handle<Value> WrapperFromGObject(Isolate *isolate, GObject *gobject) {
    if (gobject == NULL) {
        printf("WrapperFromGObject: NULL gobject\n");
        return Null(isolate);
    }

    void *data = g_object_get_qdata (gobject, gnode_js_object_quark ());

    if (data) {
        /* Easy case: we already have an object. */
        Persistent<Object> *persistent = (Persistent<Object> *) data;
        Handle<Object> obj = Handle<Object>::New (isolate, *persistent);
        return obj;
    } else {
        GType        type = G_OBJECT_TYPE(gobject);
        //const char *name  = G_OBJECT_TYPE_NAME(gobject);
        //GTypePlugin *plugin = g_type_get_plugin(type);
        void *klass = g_type_class_ref (type);

        print_gobject(gobject);
        //if (info != NULL) print_info(info);

        Handle<FunctionTemplate> tpl;

        tpl = GetClassTemplateFromGType(isolate, type);

        Handle<Function> constructor = tpl->GetFunction ();
        Handle<Value> gobject_external = External::New (isolate, gobject);
        Handle<Value> args[] = { gobject_external };
        Handle<Object> obj = constructor->NewInstance (1, args);

        //g_base_info_unref(info);
        g_type_class_unref (klass);

        return obj;
    }
}

GObject * GObjectFromWrapper(Handle<Value> value) {
    Handle<Object> object = value->ToObject ();
    void *data = object->GetAlignedPointerFromInternalField (0);
    GObject *gobject = G_OBJECT(data);
    return gobject;
}

};
