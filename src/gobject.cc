
#include <string.h>
#include "boxed.h"
#include "function.h"
#include "closure.h"
#include "gi.h"
#include "gobject.h"
#include "type.h"
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

// Our base template for all GObjects
static Nan::Persistent<FunctionTemplate> baseTemplate;


static void GObjectDestroyed(const v8::WeakCallbackInfo<GObject> &data);

static Local<FunctionTemplate> GetClassTemplateFromGI(GIBaseInfo *info);

static bool InitGParameterFromProperty(GParameter    *parameter,
                                       void          *klass,
                                       Local<String>  name,
                                       Local<Value>   value) {
    Nan::Utf8String name_utf8 (name);
    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_CLASS (klass), *name_utf8);

    // Ignore additionnal keys in options, thus return true
    if (pspec == NULL)
        return true;

    GType value_type = G_PARAM_SPEC_VALUE_TYPE (pspec);
    parameter->name = pspec->name;
    g_value_init (&parameter->value, value_type);

    if (!CanConvertV8ToGValue(&parameter->value, value)) {
        char* message = g_strdup_printf("Cannot convert value for property \"%s\", expected type %s",
                *name_utf8, g_type_name(value_type));
        Nan::ThrowTypeError(message);
        free(message);
        return false;
    }

    if (!V8ToGValue (&parameter->value, value)) {
        char* message = g_strdup_printf("Couldn't convert value for property \"%s\", expected type %s",
                *name_utf8, g_type_name(value_type));
        Nan::ThrowTypeError(message);
        free(message);
        return false;
    }

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
        Local<String> name = properties->Get(i)->ToString();
        Local<Value> value = property_hash->Get (name);

        if (!InitGParameterFromProperty (&parameters[i], klass, name->ToString (), value))
            return false;
    }

    *parameters_p = parameters;
    *n_parameters_p = n_parameters;
    return true;
}

static void ToggleNotify(gpointer user_data, GObject *gobject, gboolean toggle_down) {
    void *data = g_object_get_qdata (gobject, GNodeJS::object_quark());

    g_assert (data != NULL);

    auto *persistent = (Persistent<Object> *) data;

    if (toggle_down) {
        /* We're dropping from 2 refs to 1 ref. We are the last holder. Make
         * sure that that our weak ref is installed. */
        persistent->SetWeak (gobject, GObjectDestroyed, v8::WeakCallbackType::kParameter);
    } else {
        /* We're going from 1 ref to 2 refs. We can't let our wrapper be
         * collected, so make sure that our reference is persistent */
        persistent->ClearWeak ();
    }
}

static void AssociateGObject(Isolate *isolate, Local<Object> object, GObject *gobject) {
    object->SetAlignedPointerInInternalField (0, gobject);

    g_object_ref_sink (gobject);
    g_object_add_toggle_ref (gobject, ToggleNotify, NULL);

    Persistent<Object> *persistent = new Persistent<Object>(isolate, object);
    g_object_set_qdata (gobject, GNodeJS::object_quark(), persistent);
}

static void GObjectConstructor(const FunctionCallbackInfo<Value> &info) {
    Isolate *isolate = info.GetIsolate ();

    /* The flow of this function is a bit twisty.

     * There's two cases for when this code is called:
     * user code doing `new Gtk.Widget({ ... })`, and
     * internal code as part of WrapperFromGObject, where
     * the constructor is called with one external. */

    if (!info.IsConstructCall ()) {
        Nan::ThrowTypeError("Not a construct call.");
        return;
    }

    Local<Object> self = info.This ();

    if (info[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromGObject is called. */
        void *data = External::Cast (*info[0])->Value ();
        GObject *gobject = G_OBJECT (data);
        AssociateGObject (isolate, self, gobject);

        Nan::DefineOwnProperty(self,
                Nan::New<String>("__gtype__").ToLocalChecked(),
                Nan::New<Number>(G_OBJECT_TYPE(gobject)),
                (v8::PropertyAttribute)(v8::PropertyAttribute::ReadOnly | v8::PropertyAttribute::DontEnum)
        );
    } else {
        /* User code calling `new Gtk.Widget({ ... })` */

        GObject *gobject;
        GIBaseInfo *gi_info = (GIBaseInfo *) External::Cast (*info.Data ())->Value ();
        GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) gi_info);
        void *klass = g_type_class_ref (gtype);

        GParameter *parameters = NULL;
        int n_parameters = 0;

        if (info[0]->IsObject ()) {
            Local<Object> property_hash = info[0]->ToObject ();

            if (!InitGParametersFromProperty (&parameters, &n_parameters, klass, property_hash)) {
                // Error will already be thrown from InitGParametersFromProperty
                goto out;
            }
        }

        gobject = (GObject *) g_object_newv (gtype, n_parameters, parameters);
        AssociateGObject (isolate, self, gobject);

        Nan::DefineOwnProperty(self,
                Nan::New<String>("__gtype__").ToLocalChecked(),
                Nan::New<Number>(g_registered_type_info_get_g_type(gi_info)),
                v8::PropertyAttribute::ReadOnly
        );

    out:
        g_free (parameters);
        g_type_class_unref (klass);
    }
}

static void GObjectDestroyed(const v8::WeakCallbackInfo<GObject> &data) {
    GObject *gobject = data.GetParameter ();

    void *type_data = g_object_get_qdata (gobject, GNodeJS::object_quark());
    Persistent<Object> *persistent = (Persistent<Object> *) type_data;
    delete persistent;

    /* We're destroying the wrapper object, so make sure to clear out
     * the qdata that points back to us. */
    g_object_set_qdata (gobject, GNodeJS::object_quark(), NULL);

    g_object_unref (gobject);
}

static GISignalInfo* FindSignalInfo(GIObjectInfo *info, const char *name) {
    GISignalInfo *signal_info = NULL;

    GIBaseInfo *parent = g_base_info_ref(info);

    while (parent) {
        // Find on GObject
        signal_info = g_object_info_find_signal (parent, name);
        if (signal_info)
            break;

        // Find on Interfaces
        int n_interfaces = g_object_info_get_n_interfaces (info);
        for (int i = 0; i < n_interfaces; i++) {
            GIBaseInfo* interface_info = g_object_info_get_interface (info, i);
            signal_info = g_interface_info_find_signal (interface_info, name);
            g_base_info_unref (interface_info);
            if (signal_info)
                goto out;
        }

        GIBaseInfo* next_parent = g_object_info_get_parent(parent);
        g_base_info_unref(parent);
        parent = next_parent;
    }

out:

    if (parent)
        g_base_info_unref(parent);

    return signal_info;
}

static void ThrowSignalNotFound(GIBaseInfo *object_info, const char* signal_name) {
    char *message = g_strdup_printf("Signal \"%s\" not found for instance of %s",
            signal_name, GetInfoName(object_info));
    Nan::ThrowError(message);
    g_free(message);
}

static void SignalConnectInternal(const Nan::FunctionCallbackInfo<v8::Value> &info, bool after) {
    Isolate *isolate = info.GetIsolate ();
    GObject *gobject = GObjectFromWrapper (info.This ());

    if (!gobject) {
        Nan::ThrowTypeError("Object is not a GObject");
        return;
    }

    if (!info[0]->IsString()) {
        Nan::ThrowTypeError("Signal ID invalid");
        return;
    }

    if (!info[1]->IsFunction()) {
        Nan::ThrowTypeError("Signal callback is not a function");
        return;
    }

    const char *signal_name = *Nan::Utf8String (info[0]->ToString());
    Local<Function> callback = info[1].As<Function>();
    GType gtype = (GType) Nan::Get(info.This(), UTF8("__gtype__")).ToLocalChecked()->NumberValue();

    GIBaseInfo *object_info = g_irepository_find_by_gtype (NULL, gtype);
    GISignalInfo *signal_info = FindSignalInfo (object_info, signal_name);

    if (signal_info == NULL) {
        ThrowSignalNotFound(object_info, signal_name);
    }
    else {
        GClosure *gclosure = MakeClosure (isolate, callback, signal_info);
        ulong handler_id = g_signal_connect_closure (gobject, signal_name, gclosure, after);

        info.GetReturnValue().Set((double)handler_id);
    }

    g_base_info_unref(object_info);
}

static void SignalDisconnectInternal(const Nan::FunctionCallbackInfo<v8::Value> &info) {
    GObject *gobject = GObjectFromWrapper (info.This ());

    if (!gobject) {
        Nan::ThrowTypeError("Object is not a GObject");
        return;
    }

    if (!info[0]->IsNumber()) {
        Nan::ThrowTypeError("Signal ID should be a number");
        return;
    }

    gpointer instance = static_cast<gpointer>(gobject);
    ulong handler_id = info[0]->NumberValue();
    g_signal_handler_disconnect (instance, handler_id);

    info.GetReturnValue().Set((double)handler_id);
}

NAN_METHOD(SignalConnect) {
    SignalConnectInternal(info, false);
}

NAN_METHOD(SignalDisconnect) {
    SignalDisconnectInternal(info);
}

NAN_METHOD(GObjectToString) {
    Local<Object> self = info.This();

    if (!ValueHasInternalField(self)) {
        Nan::ThrowTypeError("Object is not a GObject");
        return;
    }

    GObject* g_object = GObjectFromWrapper(self);
    GType type = G_OBJECT_TYPE (g_object);

    const char* typeName = g_type_name(type);
    char *className = *Nan::Utf8String(self->GetConstructorName());
    void *address = self->GetAlignedPointerFromInternalField(0);

    char *str = g_strdup_printf("[%s:%s %#zx]", typeName, className, (unsigned long)address);

    info.GetReturnValue().Set(UTF8(str));
    g_free(str);
}

Local<FunctionTemplate> GetBaseClassTemplate() {
    static bool isBaseClassCreated = false;

    if (!isBaseClassCreated) {
        isBaseClassCreated = true;

        Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate>();
        Nan::SetPrototypeMethod(tpl, "connect", SignalConnect);
        Nan::SetPrototypeMethod(tpl, "disconnect", SignalDisconnect);
        Nan::SetPrototypeMethod(tpl, "toString", GObjectToString);
        baseTemplate.Reset(tpl);
    }

    // get FunctionTemplate from persistent object
    Local<FunctionTemplate> tpl = Nan::New(baseTemplate);
    return tpl;
}

static Local<FunctionTemplate> NewClassTemplate (GIBaseInfo *info) {
    const GType gtype = g_registered_type_info_get_g_type (info);

    g_assert(gtype != G_TYPE_NONE);

    const char *class_name = g_type_name (gtype);

    auto tpl = New<FunctionTemplate> (GObjectConstructor, New<External> (info));
    tpl->SetClassName (UTF8(class_name));
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    GIObjectInfo *parent_info = g_object_info_get_parent (info);
    if (parent_info) {
        auto parent_tpl = GetClassTemplateFromGI ((GIBaseInfo *) parent_info);
        tpl->Inherit(parent_tpl);
    } else {
        tpl->Inherit(GetBaseClassTemplate());
    }

    return tpl;
}

static Local<FunctionTemplate> GetClassTemplate(GType gtype) {
    void *data = g_type_get_qdata (gtype, GNodeJS::template_quark());

    if (data) {
        auto *persistent = (Persistent<FunctionTemplate> *) data;
        auto tpl = New<FunctionTemplate> (*persistent);
        return tpl;

    } else {
        GIBaseInfo *gi_info = g_irepository_find_by_gtype(NULL, gtype);

        auto tpl = NewClassTemplate(gi_info);
        auto *persistent = new Persistent<FunctionTemplate>(Isolate::GetCurrent(), tpl);
        persistent->SetWeak (
                g_base_info_ref (gi_info),
                GNodeJS::ClassDestroyed,
                WeakCallbackType::kParameter);

        g_type_set_qdata(gtype, GNodeJS::template_quark(), persistent);
        return tpl;
    }
}

static Local<FunctionTemplate> GetClassTemplateFromGI(GIBaseInfo *info) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);
    return GetClassTemplate(gtype);
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

        auto tpl = GetClassTemplate(gtype);
        Local<Function> constructor = tpl->GetFunction ();
        Local<Value> gobject_external = New<External> (gobject);
        Local<Value> args[] = { gobject_external };
        Local<Object> obj = Nan::NewInstance(constructor, 1, args).ToLocalChecked();

        return obj;
    }
}

GObject * GObjectFromWrapper(Local<Value> value) {
    if (!ValueHasInternalField(value))
        return nullptr;

    Local<Object> object = value->ToObject ();

    void    *ptr     = object->GetAlignedPointerFromInternalField (0);
    GObject *gobject = G_OBJECT (ptr);
    return gobject;
}

};
