
#include "boxed.h"
#include "debug.h"
#include "function.h"
#include "closure.h"
#include "gi.h"
#include "gobject.h"
#include "util.h"
#include "value.h"

using v8::Array;
using v8::External;
using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Persistent;
using Nan::New;
using Nan::FunctionCallbackInfo;
using Nan::WeakCallbackType;

namespace GNodeJS {

static bool InitGParameterFromProperty(GParameter    *parameter,
                                       void          *klass,
                                       Local<String>  name,
                                       Local<Value>   value) {
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
                                        Local<Object>  property_hash) {
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

static void AssociateGObject(Isolate *isolate, Local<Object> object, GObject *gobject) {
    object->SetAlignedPointerInInternalField (0, gobject);

    g_object_ref_sink (gobject);
    g_object_add_toggle_ref (gobject, ToggleNotify, NULL);

    Persistent<Object> *persistent = new Persistent<Object>(isolate, object);
    g_object_set_qdata (gobject, GNodeJS::object_quark(), persistent);
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

    Local<Object> self = args.This ();

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
    Local<Function> callback = Local<Function>::Cast (args[1]->ToObject ());
    GClosure *gclosure = MakeClosure (isolate, callback);

    // TODO return some sort of cancellation handle?
    // TODO keep track of handlers on the original object?
    ulong handler_id = g_signal_connect_closure (gobject, *signal_name, gclosure, after);
    args.GetReturnValue().Set((double)handler_id);
}

NAN_METHOD(SignalConnect) {
    SignalConnectInternal(info, false);
}

/* NAN_METHOD(ObjectPropertyGetter) {
        Isolate *isolate = info.GetIsolate ();
        GObject *gobject = GNodeJS::GObjectFromWrapper (info[0]);

        g_assert(gobject != NULL);

        String::Utf8Value prop_name_v (info[1]->ToString ());
        const char *prop_name = *prop_name_v;

        GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);

        if (pspec == NULL) {
            WARN("ObjectPropertyGetter: no property %s", prop_name);
            info.GetReturnValue().SetUndefined();
            return;
        }

        GValue value = {};
        g_value_init (&value, G_PARAM_SPEC_VALUE_TYPE (pspec));
        g_object_get_property (gobject, prop_name, &value);

        info.GetReturnValue().Set(GNodeJS::GValueToV8 (isolate, &value));
    }
    NAN_METHOD(ObjectPropertySetter) {
        GObject *gobject = GNodeJS::GObjectFromWrapper(info[0]);

        g_assert(gobject != NULL);

        String::Utf8Value prop_name_v (info[1]->ToString ());
        const char *prop_name = *prop_name_v;

        GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);

        if (pspec == NULL) {
            WARN("ObjectPropertySetter: no property %s", prop_name);
            info.GetReturnValue().SetUndefined();
            return;
        }

        GValue value = {};
        g_value_init (&value, G_PARAM_SPEC_VALUE_TYPE (pspec));
        GNodeJS::V8ToGValue (&value, info[2]);

        g_object_set_property (gobject, prop_name, &value);
    } */

static Local<FunctionTemplate> GetBaseClassTemplate() {
    static int count = 0;
    count++;
    WARN("GetBaseClassTemplate called (%i)", count);
    Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate> ();
    Nan::SetPrototypeMethod(tpl, "on", SignalConnect);
    Nan::SetPrototypeMethod(tpl, "connect", SignalConnect);
    Nan::SetPrototypeMethod(tpl, "addEventListener", SignalConnect);
    return tpl;
}

static Local<FunctionTemplate> GetClassTemplateFromGI(GIBaseInfo *info);

static void ClassDestroyed(const v8::WeakCallbackInfo<GIBaseInfo> &data) {
    GIBaseInfo *info = data.GetParameter ();
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);

    void *type_data = g_type_get_qdata (gtype, GNodeJS::template_quark());
    assert (type_data != NULL);
    Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) type_data;
    delete persistent;

    g_type_set_qdata (gtype, GNodeJS::template_quark(), NULL);
    g_base_info_unref (info);
}

static Local<FunctionTemplate> NewClassTemplate (GIBaseInfo *info) {

    const GType gtype = g_registered_type_info_get_g_type (info);

    g_assert(gtype != G_TYPE_NONE);

    const char *class_name = g_type_name (gtype);

    auto tpl = New<FunctionTemplate> (GObjectConstructor, New<External> (info));
    tpl->Set (UTF8("gtype"), New((double)gtype));
    tpl->SetClassName (UTF8(class_name));
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    GIObjectInfo *parent_info = g_object_info_get_parent (info);
    if (parent_info) {
        Local<FunctionTemplate> parent_tpl = GetClassTemplateFromGI ((GIBaseInfo *) parent_info);
        tpl->Inherit(parent_tpl);
    } else {
        tpl->Inherit(GetBaseClassTemplate());
    }

    int n_methods = g_object_info_get_n_methods(info);
    for (int i = 0; i < n_methods; ++i) {
        GIFunctionInfo *fn_info = g_object_info_get_method(info, i);
        InstallFunction(tpl, fn_info);
        g_base_info_unref(fn_info);
    }

    int n_interfaces = g_object_info_get_n_interfaces(info);
    for (int i = 0; i < n_interfaces; ++i) {
        GIInterfaceInfo *i_info = g_object_info_get_interface(info, i);
        int i_methods = g_interface_info_get_n_methods(info);
        for (int i = 0; i < i_methods; ++i) {
            GIFunctionInfo *fn_info = g_interface_info_get_method(i_info, i);
            InstallFunction(tpl, fn_info);
            g_base_info_unref(fn_info);
        }
        g_base_info_unref(i_info);
    }

    return tpl;
}

static Local<FunctionTemplate> GetClassTemplate(GIBaseInfo *info, GType gtype) {
    void *data = g_type_get_qdata (gtype, GNodeJS::template_quark());

    if (data) {
        auto *persistent = (Persistent<FunctionTemplate> *) data;
        auto tpl = New<FunctionTemplate> (*persistent);
        return tpl;

    } else {
        auto tpl = NewClassTemplate(info);
        auto *persistent = new Persistent<FunctionTemplate>(Isolate::GetCurrent(), tpl);
        persistent->SetWeak (
                g_base_info_ref (info),
                ClassDestroyed,
                WeakCallbackType::kParameter);

        g_type_set_qdata(gtype, GNodeJS::template_quark(), persistent);
        return tpl;
    }
}

static Local<FunctionTemplate> GetClassTemplateFromGI(GIBaseInfo *info) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);
    return GetClassTemplate (info, gtype);
}

static Local<FunctionTemplate> GetClassTemplateFromGType(GType gtype) {
    g_type_ensure(gtype);
    GIBaseInfo *info = g_irepository_find_by_gtype(NULL, gtype);
    return GetClassTemplate (info, gtype);
}

static void ObjectDestroyed(const v8::WeakCallbackInfo<GObject> &data) {
    GObject *gobject = data.GetParameter ();

    void *type_data = g_object_get_qdata (gobject, GNodeJS::object_quark());
    assert (type_data != NULL);
    Persistent<Object> *persistent = (Persistent<Object> *) type_data;
    delete persistent;

    /* We're destroying the wrapper object, so make sure to clear out
     * the qdata that points back to us. */
    g_object_set_qdata (gobject, GNodeJS::object_quark(), NULL);

    g_object_unref (gobject);
}

static void ToggleNotify(gpointer user_data, GObject *gobject, gboolean toggle_down) {
    void *data = g_object_get_qdata (gobject, GNodeJS::object_quark());

    g_assert (data != NULL);

    auto *persistent = (Persistent<Object> *) data;

    if (toggle_down) {
        /* We're dropping from 2 refs to 1 ref. We are the last holder. Make
         * sure that that our weak ref is installed. */
        persistent->SetWeak (gobject, ObjectDestroyed, v8::WeakCallbackType::kParameter);
    } else {
        /* We're going from 1 ref to 2 refs. We can't let our wrapper be
         * collected, so make sure that our reference is persistent */
        persistent->ClearWeak ();
    }
}

void InstallFunction (Local<FunctionTemplate> tpl, GIFunctionInfo *func_info) {
    GIFunctionInfoFlags flags = g_function_info_get_flags(func_info);
    bool is_method = ((flags & GI_FUNCTION_IS_METHOD) != 0 &&
                      (flags & GI_FUNCTION_IS_CONSTRUCTOR) == 0);

    Local<Function> fn = GNodeJS::MakeFunction (func_info);
    char *fn_name = Util::toCamelCase (g_base_info_get_name (func_info));

    if (is_method)
        Nan::SetPrototypeTemplate(tpl, fn_name, fn);
    else
        Nan::SetTemplate(tpl, fn_name, fn);

    g_free(fn_name);
}


Local<Function> MakeClass(GIBaseInfo *info) {
    auto tpl = GetClassTemplateFromGI (info);
    return tpl->GetFunction ();
}

Local<Value> WrapperFromGObject(GObject *gobject) {

    if (gobject == NULL)
        return Nan::Null();

    void *data = g_object_get_qdata (gobject, GNodeJS::object_quark());

    if (data) {
        /* Easy case: we already have an object. */
        auto *persistent = (Persistent<Object> *) data;
        auto obj = New<Object> (*persistent);
        return obj;

    } else {
        GType gtype = G_OBJECT_TYPE(gobject);
        g_type_ensure(gtype); //void *klass = g_type_class_ref (type);

        auto tpl = GetClassTemplateFromGType(gtype);
        Local<Function> constructor = tpl->GetFunction ();
        Local<Value> gobject_external = New<External> (gobject);
        Local<Value> args[] = { gobject_external };
        Local<Object> obj = constructor->NewInstance (1, args);

        return obj;
    }
}

GObject * GObjectFromWrapper(Local<Value> value) {
    Local<Object> object = value->ToObject ();

    g_assert(object->InternalFieldCount() > 0);

    void    *ptr     = object->GetAlignedPointerFromInternalField (0);
    GObject *gobject = G_OBJECT (ptr);
    return gobject;
}

};
