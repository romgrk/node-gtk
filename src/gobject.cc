
#include <string.h>

#include "boxed.h"
#include "closure.h"
#include "debug.h"
#include "error.h"
#include "function.h"
#include "gi.h"
#include "gobject.h"
#include "macros.h"
#include "type.h"
#include "util.h"
#include "value.h"

using v8::Array;
using v8::External;
using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::MaybeLocal;
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

static MaybeLocal<FunctionTemplate> GetClassTemplateFromGI(GIBaseInfo *info);

static GObject* CreateGObjectFromObject(GType gtype, Local<Value> object) {
    if (!object->IsObject ())
        return (GObject*) g_object_new(gtype, NULL);

    Local<Object> property_hash = TO_OBJECT (object);
    Local<Array> properties = Nan::GetOwnPropertyNames (property_hash).ToLocalChecked();
    int n_properties = properties->Length ();
    const char **names = g_new0 (const char*, n_properties + 1);
    GValue *values = g_new0 (GValue, n_properties);

    void *klass = g_type_class_ref (gtype);
    GObject *gobject = NULL;

    for (int i = 0; i < n_properties; i++) {
        Local<String> name = TO_STRING (Nan::Get(properties, i).ToLocalChecked());
        const char *name_string = g_strdup (*Nan::Utf8String(name));
        Local<Value> value = Nan::Get(property_hash, name).ToLocalChecked();

        GType value_gtype = g_object_class_find_property (G_OBJECT_CLASS (klass), name_string)->value_type;

        g_value_init(&values[i], value_gtype);

        if (!V8ToGValue(&values[i], value))
            goto out;

        names[i] = name_string;
    }

    gobject = (GObject*) g_object_new_with_properties(gtype, n_properties, names, values);

out:
    g_strfreev ((gchar**) names);
    g_free (values);
    g_type_class_unref (klass);

    return gobject;
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

        gobject = CreateGObjectFromObject (gtype, info[0]);

        if (gobject == NULL) {
            // Error will already be thrown from CreateGObjectFromObject
            return;
        }

        AssociateGObject (isolate, self, gobject);

        Nan::DefineOwnProperty(self,
                UTF8("__gtype__"),
                Nan::New<Number>(gtype),
                (v8::PropertyAttribute)(v8::PropertyAttribute::ReadOnly | v8::PropertyAttribute::DontEnum)
        );
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

static void GObjectClassDestroyed(const v8::WeakCallbackInfo<GIBaseInfo> &info) {
    GIBaseInfo *gi_info = info.GetParameter ();
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) gi_info);

    auto *persistent = (Persistent<FunctionTemplate> *) g_type_get_qdata (gtype, GNodeJS::template_quark());
    delete persistent;

    g_type_set_qdata (gtype, GNodeJS::template_quark(), NULL);
    g_base_info_unref (gi_info);
}

static GISignalInfo* FindSignalInfo(GIObjectInfo *info, const char *signal_detail) {
    char* signal_name = Util::GetSignalName(signal_detail);

    GISignalInfo *signal_info = NULL;

    GIBaseInfo *parent = g_base_info_ref(info);

    while (parent) {
        // Find on GObject
        signal_info = g_object_info_find_signal (parent, signal_name);
        if (signal_info)
            break;

        // Find on Interfaces
        int n_interfaces = g_object_info_get_n_interfaces (info);
        for (int i = 0; i < n_interfaces; i++) {
            GIBaseInfo* interface_info = g_object_info_get_interface (info, i);
            signal_info = g_interface_info_find_signal (interface_info, signal_name);
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

    g_free(signal_name);

    return signal_info;
}

static void ThrowSignalNotFound(GIBaseInfo *object_info, const char* signal_name) {
    char *message = g_strdup_printf("Signal \"%s\" not found for instance of %s",
            signal_name, GetInfoName(object_info));
    Nan::ThrowError(message);
    g_free(message);
}

static void SignalConnectInternal(const Nan::FunctionCallbackInfo<v8::Value> &info, bool after) {
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

    Local<Function> callback = info[1].As<Function>();
    GType gtype = (GType) TO_LONG (Nan::Get(info.This(), UTF8("__gtype__")).ToLocalChecked());

    GIBaseInfo *object_info = g_irepository_find_by_gtype (NULL, gtype);

    if (object_info == NULL) {
        Throw::InvalidGType(NULL, gtype);
        return;
    }

    const char *signal_name = *Nan::Utf8String (TO_STRING (info[0]));
    GISignalInfo *signal_info = FindSignalInfo (object_info, signal_name);

    if (signal_info == NULL) {
        ThrowSignalNotFound(object_info, signal_name);
    }
    else {
        GClosure *gclosure = MakeClosure (callback, signal_info);
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
    ulong handler_id = TO_LONG (info[0]);
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

static MaybeLocal<FunctionTemplate> NewClassTemplate (GIBaseInfo *info, GType gtype) {
    g_assert(gtype != G_TYPE_NONE);

    const char *class_name = g_type_name (gtype);

    auto tpl = New<FunctionTemplate> (GObjectConstructor, New<External> (info));
    tpl->SetClassName (UTF8(class_name));
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    GIObjectInfo *parent_info = g_object_info_get_parent (info);
    if (parent_info) {
        auto parent_tpl = GetClassTemplateFromGI ((GIBaseInfo *) parent_info);
        if (parent_tpl.IsEmpty())
            return MaybeLocal<FunctionTemplate> ();
        tpl->Inherit(parent_tpl.ToLocalChecked());
    } else {
        tpl->Inherit(GetBaseClassTemplate());
    }

    return MaybeLocal<FunctionTemplate> (tpl);
}

static MaybeLocal<FunctionTemplate> GetClassTemplate(GIBaseInfo *gi_info, GType gtype) {
    void *data = g_type_get_qdata (gtype, GNodeJS::template_quark());

    if (data) {
        auto *persistent = (Persistent<FunctionTemplate> *) data;
        auto tpl = New<FunctionTemplate> (*persistent);
        return tpl;
    }

    if (gi_info == NULL)
        gi_info = g_irepository_find_by_gtype(NULL, gtype);

    assert_printf (gi_info != NULL, "Missing GIR info for: %s\n", g_type_name (gtype));

    auto maybeTpl = NewClassTemplate(gi_info, gtype);
    if (maybeTpl.IsEmpty())
        return MaybeLocal<FunctionTemplate> ();

    auto tpl = maybeTpl.ToLocalChecked();
    auto *persistent = new Persistent<FunctionTemplate>(Isolate::GetCurrent(), tpl);
    persistent->SetWeak (
            g_base_info_ref (gi_info),
            GObjectClassDestroyed,
            WeakCallbackType::kParameter);

    g_type_set_qdata(gtype, GNodeJS::template_quark(), persistent);
    return MaybeLocal<FunctionTemplate> (tpl);
}

static MaybeLocal<FunctionTemplate> GetClassTemplateFromGI(GIBaseInfo *info) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);

    if (gtype == G_TYPE_NONE) {
        const char *error = g_module_error();
        Throw::GTypeNotFound(info, error);
        return MaybeLocal<FunctionTemplate>();
    }

    auto tpl = GetClassTemplate(info, gtype);

    if (tpl.IsEmpty())
        return MaybeLocal<FunctionTemplate> ();

    return MaybeLocal<FunctionTemplate> (tpl);
}

MaybeLocal<Function> MakeClass(GIBaseInfo *info) {
    auto tpl = GetClassTemplateFromGI (info);
    if (tpl.IsEmpty())
        return MaybeLocal<Function> ();
    return MaybeLocal<Function> (Nan::GetFunction (tpl.ToLocalChecked()));
}

Local<Value> WrapperFromGObject(GObject *gobject, GIBaseInfo *object_info) {
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
        g_type_ensure (gtype); //void *klass = g_type_class_ref (type);
        // We don't use the gtype above, but maybe we can register that type using the type's interface's object_info.

        auto maybeTpl = GetClassTemplateFromGI(object_info);
        if (maybeTpl.IsEmpty())
            return Nan::Null();
        auto tpl = maybeTpl.ToLocalChecked();
        Local<Function> constructor = Nan::GetFunction (tpl).ToLocalChecked();
        Local<Value> gobject_external = New<External> (gobject);
        Local<Value> args[] = { gobject_external };
        Local<Object> obj = Nan::NewInstance(constructor, 1, args).ToLocalChecked();

        return obj;
    }
}

GObject * GObjectFromWrapper(Local<Value> value) {
    if (!ValueHasInternalField(value))
        return nullptr;

    Local<Object> object = TO_OBJECT (value);

    void    *ptr     = object->GetAlignedPointerFromInternalField (0);
    GObject *gobject = G_OBJECT (ptr);
    return gobject;
}

};
