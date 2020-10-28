
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

static MaybeLocal<FunctionTemplate> GetClassTemplate(GType gtype);


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

    int n_valid_properties = 0;
    int index = 0;

    for (int i = 0; i < n_properties; i++) {
        Local<String> name = TO_STRING (Nan::Get(properties, i).ToLocalChecked());
        const char *name_string = g_strdup (*Nan::Utf8String(name));
        Local<Value> value = Nan::Get(property_hash, name).ToLocalChecked();

        auto value_spec = g_object_class_find_property (G_OBJECT_CLASS (klass), name_string);
        if (value_spec == NULL) {
            Throw::InvalidPropertyName(name_string);
            goto out;
        }

        index = n_valid_properties++;

        g_value_init(&values[index], value_spec->value_type);

        if (!V8ToGValue(&values[index], value, true)) {
            // V8ToGValue throws the error
            goto out;
        }

        names[index] = name_string;
    }

    gobject = (GObject*) g_object_new_with_properties(gtype, n_valid_properties, names, values);

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
        GType gtype = (GType) External::Cast(*info.Data())->Value();

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

static void GObjectClassDestroyed(const v8::WeakCallbackInfo<GType> &info) {
    GType* gtypePtr = info.GetParameter();
    GType gtype = *gtypePtr;

    auto *persistent = (Persistent<FunctionTemplate> *) g_type_get_qdata (gtype, GNodeJS::template_quark());
    delete persistent;

    g_type_set_qdata (gtype, GNodeJS::template_quark(), NULL);
    g_free(gtypePtr);
}

static GISignalInfo* FindSignalInfo(GIObjectInfo *info, const char *signal_detail) {
    char* signalName = Util::GetSignalName(signal_detail);

    GISignalInfo *signalInfo = NULL;

    GIBaseInfo *current = g_base_info_ref(info);

    while (current) {
        // Find on GObject
        signalInfo = g_object_info_find_signal (current, signalName);
        if (signalInfo)
            break;

        // Find on Interfaces
        int n_interfaces = g_object_info_get_n_interfaces (current);
        for (int i = 0; i < n_interfaces; i++) {
            GIBaseInfo* interface_info = g_object_info_get_interface (current, i);
            signalInfo = g_interface_info_find_signal (interface_info, signalName);
            g_base_info_unref (interface_info);

            if (signalInfo)
                goto out;
        }

        GIBaseInfo* parent = g_object_info_get_parent(current);
        g_base_info_unref(current);
        current = parent;
    }

out:

    if (current)
        g_base_info_unref(current);

    g_free(signalName);

    return signalInfo;
}

static bool HasReturnValue(GICallableInfo *signalInfo, GITypeInfo *returnInfo) {
    auto tag = g_type_info_get_tag(returnInfo);
    return !g_callable_info_skip_return(signalInfo) && tag != GI_TYPE_TAG_VOID;
}

NAN_METHOD(SignalConnect) {
    bool after = false;

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

    if (info[2]->IsBoolean()) {
        after = Nan::To<bool>(info[2]).ToChecked();
    }

    Local<Function> callback = info[1].As<Function>();
    GType gtype = GET_OBJECT_GTYPE (info.This());

    GIBaseInfo *object_info = g_irepository_find_by_gtype (NULL, gtype);

    guint signalId;
    GQuark detail;
    GClosure *gclosure;
    ulong handler_id;

    const char *signalName = *Nan::Utf8String (TO_STRING (info[0]));
    if (!g_signal_parse_name(signalName, gtype, &signalId, &detail, FALSE)) {
        Nan::ThrowTypeError("Signal name is invalid");
        return;
    }
    GISignalInfo* signal_info = NULL;
    if (object_info) {
        signal_info = FindSignalInfo (object_info, signalName);
        if (signal_info == NULL) {
            Throw::SignalNotFound(object_info, signalName);
            goto out;
        }
    }

    gclosure = Closure::New (callback, signal_info, signalId);
    handler_id = g_signal_connect_closure (gobject, signalName, gclosure, after);

    info.GetReturnValue().Set((double)handler_id);

out:
    if (signal_info) g_base_info_unref(signal_info);
    if (object_info) g_base_info_unref(object_info);
}

NAN_METHOD(SignalDisconnect) {
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

NAN_METHOD(SignalEmit) {

    if (!info[0]->IsString()) {
        Nan::ThrowTypeError("Signal name should be a string");
        return;
    }

    Local<Object> self = info.This();
    GObject *gobject = GObjectFromWrapper (self);
    GType gtype = G_OBJECT_TYPE (gobject);

    size_t argc;
    bool failed;

    guint signal_id;
    GQuark detail_id;
    GSignalQuery signal_query;
    GValue rvalue = G_VALUE_INIT;
    GValue* args;

    const char *detailedSignal = *Nan::Utf8String(TO_STRING(info[0]));

    if (!g_signal_parse_name(detailedSignal, gtype, &signal_id, &detail_id, FALSE)) {
        Throw::InvalidSignal(g_type_name(gtype), detailedSignal);
        return;
    }

    g_signal_query(signal_id, &signal_query);

    /*
     * For signals, the instance is an implicit parameter,
     * therefore we add space for 1 more argument.
     */
    argc = signal_query.n_params + 1;

    if ((info.Length() - 1) < (int) signal_query.n_params) {
        Throw::NotEnoughArguments(signal_query.n_params + 1, info.Length());
        return;
    }

    if (signal_query.return_type != G_TYPE_NONE) {
        g_value_init(&rvalue, signal_query.return_type & ~G_SIGNAL_TYPE_STATIC_SCOPE);
    }

    args = g_newa(GValue, argc);
    memset(args, 0, sizeof(GValue) * argc);

    g_value_init(&args[0], G_OBJECT_TYPE (gobject));
    g_value_set_object(&args[0], gobject);

    failed = false;
    for (uint i = 0; i < signal_query.n_params; i++) {
        GValue *gvalue = &args[i + 1];

        g_value_init(gvalue, signal_query.param_types[i] & ~G_SIGNAL_TYPE_STATIC_SCOPE);

        if ((signal_query.param_types[i] & G_SIGNAL_TYPE_STATIC_SCOPE) != 0)
            failed = !V8ToGValue(gvalue, info[i + 1], false); // no-copy
        else
            failed = !V8ToGValue(gvalue, info[i + 1], true); // copy

        if (failed)
            break;
    }

    if (!failed) {
        g_signal_emitv(args, signal_id, detail_id, &rvalue);

        if (signal_query.return_type != G_TYPE_NONE) {
            RETURN (GValueToV8(&rvalue));
            g_value_unset(&rvalue);
        }
    }

    for (uint i = 0; i < argc; i++) {
        g_value_unset(&args[i]);
    }
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
        Nan::SetPrototypeMethod(tpl, "emit", SignalEmit);
        Nan::SetPrototypeMethod(tpl, "toString", GObjectToString);
        baseTemplate.Reset(tpl);
    }

    // get FunctionTemplate from persistent object
    Local<FunctionTemplate> tpl = Nan::New(baseTemplate);
    return tpl;
}

static void GObjectFallbackPropertyGetter(Local<v8::Name> property,
                                            const v8::PropertyCallbackInfo<Value>& info) {
    auto self = info.Holder();
    GObject *gobject = GObjectFromWrapper (self);

    g_assert(gobject != NULL);

    Nan::Utf8String prop_name_v (TO_STRING (property));
    const char *prop_name_camel = *prop_name_v;

    if (strstr(prop_name_camel, "-")) {
        // Has dash, not a camel-case property name.
        RETURN(Nan::Undefined());
        return;
    }

    char *prop_name = Util::ToDashed(prop_name_camel);

    RETURN(GetGObjectProperty(gobject, prop_name));

    g_free(prop_name);
}

static void GObjectFallbackPropertySetter (Local<v8::Name> property, Local<Value> value,
                                            const v8::PropertyCallbackInfo<Value>& info) {
    auto self = info.Holder();
    GObject *gobject = GNodeJS::GObjectFromWrapper (self);

    Nan::Utf8String prop_name_v (TO_STRING (property));
    const char *prop_name_camel = *prop_name_v;

    if (strstr(prop_name_camel, "-")) {
        // Has dash, not a camel-case property name.
        return;
    }

    char *prop_name = Util::ToDashed(prop_name_camel);

    if (gobject == NULL) {
        WARN("ObjectPropertySetter: null GObject; cant set %s", prop_name);
        g_free(prop_name);
        return;
    }

    v8::TryCatch trycatch(info.GetIsolate());
    auto setResult = SetGObjectProperty(gobject, prop_name, value);
    if (setResult.IsEmpty()) {
        // Non-existent property. We catch the exception and consider the set
        // not intercepted by not setting return value;
    } else {
        // Property exists. Whether we can convert the value and set the
        // property or not, consider the set intercepted.
        RETURN(value);
    }

    g_free(prop_name);
}

static MaybeLocal<FunctionTemplate> NewClassTemplate (GType gtype) {
    g_assert(gtype != G_TYPE_NONE && gtype != G_TYPE_INVALID);

    const char *class_name = g_type_name (gtype);

    auto tpl = New<FunctionTemplate> (GObjectConstructor, New<External>((void *) gtype));
    tpl->SetClassName (UTF8(class_name));
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    GType parent_type = g_type_parent(gtype);
    if (parent_type == G_TYPE_INVALID) {
        tpl->Inherit(GetBaseClassTemplate());
    } else {
        auto parent_tpl = GetClassTemplate(parent_type);
        if (parent_tpl.IsEmpty())
            return MaybeLocal<FunctionTemplate> ();
        tpl->Inherit(parent_tpl.ToLocalChecked());
    }

    // Set the fallback accessor to allow non-introspected property.
    // Nan::SetNamedPropertyHandler() does not support flags. Thus, using
    // V8 interface directly.
    v8::NamedPropertyHandlerConfiguration config;
    config.getter = GObjectFallbackPropertyGetter;
    config.setter = GObjectFallbackPropertySetter;
    config.flags = static_cast<v8::PropertyHandlerFlags>(
        static_cast<int>(v8::PropertyHandlerFlags::kNonMasking) |
        static_cast<int>(v8::PropertyHandlerFlags::kOnlyInterceptStrings));
    tpl->InstanceTemplate()->SetHandler(config);

    return MaybeLocal<FunctionTemplate> (tpl);
}

static MaybeLocal<FunctionTemplate> GetClassTemplate(GType gtype) {
    void *data = g_type_get_qdata (gtype, GNodeJS::template_quark());

    if (data) {
        auto *persistent = (Persistent<FunctionTemplate> *) data;
        auto tpl = New<FunctionTemplate> (*persistent);
        return tpl;
    }

    auto maybeTpl = NewClassTemplate(gtype);
    if (maybeTpl.IsEmpty())
        return MaybeLocal<FunctionTemplate> ();

    auto tpl = maybeTpl.ToLocalChecked();
    auto *persistent = new Persistent<FunctionTemplate>(Isolate::GetCurrent(), tpl);

    GType *gtypePtr = g_new(GType, 1);
    persistent->SetWeak(gtypePtr, GObjectClassDestroyed,
                        WeakCallbackType::kParameter);
    g_type_set_qdata(gtype, GNodeJS::template_quark(), persistent);
    return MaybeLocal<FunctionTemplate> (tpl);
}

MaybeLocal<Function> MakeClass(GIBaseInfo *info) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);

    if (gtype == G_TYPE_NONE || gtype == G_TYPE_INVALID) {
        const char *error = g_module_error();
        Throw::GTypeNotFound(info, error);
        return MaybeLocal<Function>();
    }

    auto tpl = GetClassTemplate(gtype);
    if (tpl.IsEmpty())
        return MaybeLocal<Function> ();

    return MaybeLocal<Function> (Nan::GetFunction (tpl.ToLocalChecked()));
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
        auto maybeTpl = GetClassTemplate(gtype);
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

Local<Value> GetGObjectProperty(GObject * gobject, const char *prop_name) {
    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);

    if (pspec == NULL) {
        return Nan::Undefined();
    }

    GValue value = G_VALUE_INIT;
    g_value_init (&value, G_PARAM_SPEC_VALUE_TYPE (pspec));
    g_object_get_property (gobject, prop_name, &value);

    auto ret = GNodeJS::GValueToV8(&value, true);

    g_value_unset(&value);

    return ret;
}

Local<v8::Boolean> SetGObjectProperty(GObject * gobject, const char *prop_name, Local<Value> value) {
    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);

    if (pspec == NULL) {
        Nan::ThrowError("Unexistent property");
        return Local<v8::Boolean> ();
    }

    Local<v8::Boolean> ret;

    GValue gvalue = G_VALUE_INIT;
    g_value_init(&gvalue, G_PARAM_SPEC_VALUE_TYPE (pspec));

    if (GNodeJS::V8ToGValue (&gvalue, value, true)) {
        g_object_set_property (gobject, prop_name, &gvalue);
        ret = Nan::True();
    } else {
        ret = Nan::False();
    }

    g_value_unset(&gvalue);
    return ret;
}

};
