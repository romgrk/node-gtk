
#include <string.h>

#include "boxed.h"
#include "callback.h"
#include "closure.h"
#include "error.h"
#include "function.h"
#include "gi.h"
#include "gobject.h"
#include "macros.h"
#include "util.h"
#include "value.h"

using v8::Array;
using v8::BigInt;
using v8::External;
using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::MaybeLocal;
using v8::Object;
using v8::String;
using Nan::New;
using Nan::Persistent;
using Nan::FunctionCallbackInfo;
using Nan::WeakCallbackType;

#define OFFSET_NOT_FOUND 0xffff

namespace GNodeJS {

// Our base template for all GObjects
static Nan::Persistent<FunctionTemplate> baseTemplate;


static void GObjectDestroyed(const Nan::WeakCallbackInfo<GObject> &data);
static MaybeLocal<FunctionTemplate> GetClassTemplate(GType gtype);
static MaybeLocal<Function>         GetClass(GType gtype);
static void StoreVFunc(GType gtype, Callback *callback);
static void DestroyVFuncs(GType gtype);


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

        if (!V8ToGValue(&values[index], value, kCopy)) {
            // V8ToGValue throws the error
            goto out;
        }

        names[index] = name_string;
    }

    gobject = (GObject*) g_object_new_with_properties(gtype, n_valid_properties, names, values);

out:
    g_strfreev ((gchar**) names);

    for (int i = 0; i < n_properties; i++)
        g_value_unset(&values[i]);
    g_free (values);

    g_type_class_unref (klass);

    return gobject;
}

static void ToggleNotify(gpointer user_data, GObject *gobject, gboolean toggle_down) {
    void *data = g_object_get_qdata (gobject, GNodeJS::object_quark());

    g_assert (data != NULL);

    auto *persistent = (Nan::Persistent<Object> *) data;

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

static void AssociateGObject(Local<Object> object, GObject *gobject, GType gtype) {
    object->SetAlignedPointerInInternalField (0, gobject);

    SET_OBJECT_GTYPE(object, gtype);

    auto *persistent = new Nan::Persistent<Object>(object);
    g_object_set_qdata (gobject, GNodeJS::object_quark(), persistent);

    // Because we can't sink floating ref and add toggle ref at the same time,
    // first sink the floating ref, add the toggle ref, and then release the
    // ref we've just sunken. At the end, we must carry only the toggle ref.
    g_object_ref_sink (gobject);
    g_object_add_toggle_ref (gobject, ToggleNotify, NULL);
    g_object_unref (gobject);
}

static void GObjectConstructor(const FunctionCallbackInfo<Value> &info) {
    /* The flow of this function is a bit twisty.

     * There's two cases for when this code is called:
     * user code doing `new Gtk.Widget({ ... })`, and
     * internal code as part of WrapperFromGObject, where
     * the constructor is called with one external. */

    if (!info.IsConstructCall ()) {
        Nan::ThrowTypeError("Not a construct call.");
        return;
    }

    GObject *gobject;
    GType gtype;
    Local<Object> self = info.This ();

    if (info[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromGObject is called. */
        gobject = G_OBJECT (External::Cast (*info[0])->Value ());
        gtype   = G_OBJECT_TYPE (gobject);
        AssociateGObject(self, gobject, gtype);
        return;
    }

    /* User code calling `new Gtk.Widget({ ... })` */

    // FIXME: getting the gtype from the External is faster but doesn't
    // work for dynamically-registered types. Check if we can find something
    // better.
    //gtype = (GType) External::Cast(*info.Data())->Value();
    gtype = GET_OBJECT_GTYPE (Nan::To<Object>(self->GetPrototype()).ToLocalChecked());

    gobject = CreateGObjectFromObject (gtype, info[0]);

    if (gobject == NULL) {
        // Error will already be thrown from CreateGObjectFromObject
        return;
    }

    AssociateGObject(self, gobject, gtype);
    if (G_IS_INITIALLY_UNOWNED(gobject)) {
        // AssociateGObject() has sunken the floating ref.
    } else {
        // AssociateGObject() has added its own ref.
        g_object_unref(gobject);
    }
}

static void GObjectDestroyed(const Nan::WeakCallbackInfo<GObject> &data) {
    GObject *gobject = data.GetParameter ();

    void *type_data = g_object_get_qdata (gobject, GNodeJS::object_quark());
    auto *persistent = (Nan::Persistent<Object> *) type_data;
    delete persistent;

    /* We're destroying the wrapper object, so make sure to clear out
     * the qdata that points back to us. */
    g_object_set_qdata (gobject, GNodeJS::object_quark(), NULL);

    g_object_remove_toggle_ref (gobject, &ToggleNotify, NULL);
}

static void GObjectClassDestroyed(const Nan::WeakCallbackInfo<GType> &info) {
    GType* gtypePtr = info.GetParameter();
    GType gtype = *gtypePtr;

    DestroyVFuncs(gtype);

    auto persistentTpl = (Nan::Persistent<FunctionTemplate> *)
        g_type_get_qdata (gtype, GNodeJS::template_quark());
    auto persistentFn  = (Nan::Persistent<Function> *)
        g_type_get_qdata (gtype, GNodeJS::function_quark());
    delete persistentTpl;
    delete persistentFn;

    g_type_set_qdata (gtype, GNodeJS::template_quark(), NULL);
    g_type_set_qdata (gtype, GNodeJS::function_quark(), NULL);
    g_free(gtypePtr);
}

#if defined(V8_MAJOR_VERSION) && (V8_MAJOR_VERSION > 12 || \
    (V8_MAJOR_VERSION == 12 && defined(V8_MINOR_VERSION) && V8_MINOR_VERSION > 4))
#define PROPERTY_CALLBACK_RETURN_TYPE v8::Intercepted
#define PROPERTY_CALLBACK_INFO_TYPE v8::PropertyCallbackInfo<void>
#else
#define PROPERTY_CALLBACK_RETURN_TYPE void
#define PROPERTY_CALLBACK_INFO_TYPE v8::PropertyCallbackInfo<Value>
#endif

static PROPERTY_CALLBACK_RETURN_TYPE
GObjectFallbackPropertyGetter(Local<v8::Name> property,
                              const v8::PropertyCallbackInfo<Value>& info) {
    auto self = info.Holder();
    GObject *gobject = GObjectFromWrapper (self);

    g_assert(gobject != NULL);

    Nan::Utf8String prop_name_v (TO_STRING (property));
    const char *prop_name_camel = *prop_name_v;

    if (strstr(prop_name_camel, "-")) {
        // Has dash, not a camel-case property name.
        RETURN(Nan::Undefined());
        return Nan::Intercepted::Yes();
    }

    char *prop_name = Util::ToDashed(prop_name_camel);

    auto value = GetGObjectProperty(gobject, prop_name);
    if (!value.IsEmpty()) {
        RETURN(value.ToLocalChecked());
        g_free(prop_name);
        return Nan::Intercepted::Yes();
    }

    g_free(prop_name);
    return Nan::Intercepted::No();
}

static PROPERTY_CALLBACK_RETURN_TYPE
GObjectFallbackPropertySetter(Local<v8::Name> property, Local<Value> value,
                              const PROPERTY_CALLBACK_INFO_TYPE& info) {
    auto self = info.Holder();
    GObject *gobject = GNodeJS::GObjectFromWrapper (self);

    Nan::Utf8String prop_name_v (TO_STRING (property));
    const char *prop_name_camel = *prop_name_v;

    if (strstr(prop_name_camel, "-")) {
        // Has dash, not a camel-case property name.
        return Nan::Intercepted::No();
    }

    char *prop_name = Util::ToDashed(prop_name_camel);

    if (gobject == NULL) {
        WARN("Can't set \"%s\" on null GObject", prop_name);
        g_free(prop_name);
        return Nan::Intercepted::No();
    }

    auto setResult = SetGObjectProperty(gobject, prop_name, value);
    if (setResult.IsEmpty()) {
        // Non-existent property. Let node consider the set not intercepted
        // by not setting return value;
        g_free(prop_name);
        return Nan::Intercepted::No();
    } else {
        // Property exists. Whether we can convert the value and set the
        // property or not, consider the set intercepted.
        RETURN(value);
        g_free(prop_name);
        return Nan::Intercepted::Yes();
    }
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

static void StoreVFunc(GType gtype, Callback *callback) {
    auto vfuncList = (GSList*) g_type_get_qdata(gtype, GNodeJS::vfuncs_quark());
    vfuncList = g_slist_prepend(vfuncList, (gpointer) callback);
    g_type_set_qdata(gtype, GNodeJS::vfuncs_quark(), vfuncList);
}

static void DestroyVFuncs(GType gtype) {
    /* Destroy vfunc list, if any */
    GSList *list = (GSList *) g_type_get_qdata (gtype, GNodeJS::vfuncs_quark());
    GSList *item = list;
    while ((item = g_slist_next (item)) != NULL) {
        auto callback = (Callback *) item->data;
        delete callback;
    }
    g_slist_free (list);
    g_type_set_qdata (gtype, GNodeJS::vfuncs_quark(), NULL);
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
    gulong handler_id;

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
    gulong handler_id = TO_LONG (info[0]);
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
    for (guint i = 0; i < signal_query.n_params; i++) {
        GValue *gvalue = &args[i + 1];

        g_value_init(gvalue, signal_query.param_types[i] & ~G_SIGNAL_TYPE_STATIC_SCOPE);

        if ((signal_query.param_types[i] & G_SIGNAL_TYPE_STATIC_SCOPE) != 0)
            failed = !V8ToGValue(gvalue, info[i + 1], kNone); // no-copy
        else
            failed = !V8ToGValue(gvalue, info[i + 1], kCopy); // copy

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

    for (guint i = 0; i < argc; i++) {
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

    char *str = g_strdup_printf("[%s:%s %#zx]", typeName, className, (size_t)address);

    info.GetReturnValue().Set(UTF8(str));
    g_free(str);
}


Local<FunctionTemplate> GetBaseClassTemplate() {
    static bool isBaseClassCreated = false;

    if (!isBaseClassCreated) {
        isBaseClassCreated = true;

        Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate>();
        tpl->SetClassName (UTF8("BaseClass"));
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

static MaybeLocal<FunctionTemplate> NewClassTemplate (GType gtype) {
    g_assert(gtype != G_TYPE_NONE && gtype != G_TYPE_INVALID);

    const char *class_name = g_type_name (gtype);

    auto tpl = New<FunctionTemplate> (GObjectConstructor, New<External>((void *) gtype));
    tpl->SetClassName (UTF8(class_name));
    tpl->InstanceTemplate()->SetInternalFieldCount(1);
    Nan::SetPrototypeTemplate(
        tpl, "__gtype__", v8::BigInt::NewFromUnsigned(v8::Isolate::GetCurrent(), gtype));

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
    v8::NamedPropertyHandlerConfiguration config(GObjectFallbackPropertyGetter,
        GObjectFallbackPropertySetter);
    config.flags = static_cast<v8::PropertyHandlerFlags>(
        static_cast<int>(v8::PropertyHandlerFlags::kNonMasking) |
        static_cast<int>(v8::PropertyHandlerFlags::kOnlyInterceptStrings));
    tpl->InstanceTemplate()->SetHandler(config);

    return MaybeLocal<FunctionTemplate> (tpl);
}

static MaybeLocal<FunctionTemplate> GetClassTemplate(GType gtype) {
    void *data = g_type_get_qdata (gtype, GNodeJS::template_quark());

    if (data) {
        auto *persistent = (Nan::Persistent<FunctionTemplate> *) data;
        auto tpl = New<FunctionTemplate> (*persistent);
        return tpl;
    }

    auto maybeTpl = NewClassTemplate(gtype);
    if (maybeTpl.IsEmpty())
        return MaybeLocal<FunctionTemplate> ();

    auto tpl = maybeTpl.ToLocalChecked();
    auto fn = Nan::GetFunction (tpl).ToLocalChecked();
    auto persistentTpl = new Nan::Persistent<FunctionTemplate>(tpl);
    auto persistentFn  = new Nan::Persistent<Function>(fn);

    GType *gtypePtr = g_new(GType, 1);
    *gtypePtr = gtype;

    persistentTpl->SetWeak(
        gtypePtr, GObjectClassDestroyed, WeakCallbackType::kParameter);

    g_type_set_qdata(gtype, GNodeJS::template_quark(), persistentTpl);
    g_type_set_qdata(gtype, GNodeJS::function_quark(), persistentFn);

    return MaybeLocal<FunctionTemplate> (tpl);
}

static MaybeLocal<Function> GetClass(GType gtype) {
    void *data = g_type_get_qdata (gtype, GNodeJS::function_quark());

    if (data) {
        auto persistent = (Nan::Persistent<Function> *) data;
        auto fn = New<Function> (*persistent);
        return MaybeLocal<Function> (fn);
    }

    /* GetClassTemplate() will initalize function_quark */
    auto maybeTpl = GetClassTemplate(gtype);
    if (maybeTpl.IsEmpty()) {
        ERROR("Failed initialization of function %s", g_type_name(gtype));
        return MaybeLocal<Function> ();
    }

    data = g_type_get_qdata (gtype, GNodeJS::function_quark());

    if (data) {
        auto persistent = (Nan::Persistent<Function> *) data;
        auto fn = New<Function> (*persistent);
        return MaybeLocal<Function> (fn);
    }

    ERROR("Could not retrieve function %s", g_type_name(gtype));
    return MaybeLocal<Function> ();
}

MaybeLocal<Function> MakeClass(GIBaseInfo *info) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);

    if (gtype == G_TYPE_NONE || gtype == G_TYPE_INVALID) {
        const char *error = g_module_error();
        Throw::GTypeNotFound(info, error);
        return MaybeLocal<Function>();
    }

    return GetClass(gtype);
}

Local<Value> WrapperFromGObject(GObject *gobject) {
    if (gobject == NULL)
        return Nan::Null();

    void *data = g_object_get_qdata (gobject, GNodeJS::object_quark());

    if (data) {
        /* Easy case: we already have an object. */
        auto *persistent = (Nan::Persistent<Object> *) data;
        auto obj = New<Object> (*persistent);
        return obj;
    }

    GType gtype = G_OBJECT_TYPE(gobject);
    auto maybeFn = GetClass(gtype);
    if (maybeFn.IsEmpty())
        return Nan::Null();

    Local<Function> constructor = maybeFn.ToLocalChecked();
    Local<Value> gobject_external = New<External> (gobject);
    Local<Value> args[] = { gobject_external };
    Local<Object> obj = Nan::NewInstance(constructor, 1, args).ToLocalChecked();

    return obj;
}

GObject * GObjectFromWrapper(Local<Value> value) {
    if (!ValueHasInternalField(value))
        return nullptr;

    Local<Object> object = TO_OBJECT (value);

    void    *ptr     = object->GetAlignedPointerFromInternalField (0);
    GObject *gobject = G_OBJECT (ptr);
    return gobject;
}

MaybeLocal<Value> GetGObjectProperty(GObject * gobject, const char *prop_name) {
    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);

    if (pspec == NULL) {
        return MaybeLocal<Value>();
    }

    GValue value = G_VALUE_INIT;
    g_value_init (&value, G_PARAM_SPEC_VALUE_TYPE (pspec));
    g_object_get_property (gobject, prop_name, &value);

    auto ret = GNodeJS::GValueToV8(&value, kCopy);

    g_value_unset(&value);

    return MaybeLocal<Value>(ret);
}

MaybeLocal<v8::Boolean> SetGObjectProperty(GObject * gobject, const char *prop_name, Local<Value> value) {
    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);

    if (pspec == NULL) {
        return MaybeLocal<v8::Boolean>();
    }

    Local<v8::Boolean> ret;

    GValue gvalue = G_VALUE_INIT;
    g_value_init(&gvalue, G_PARAM_SPEC_VALUE_TYPE (pspec));

    if (GNodeJS::V8ToGValue (&gvalue, value, kCopy)) {
        g_object_set_property (gobject, prop_name, &gvalue);
        ret = Nan::True();
    } else {
        ret = Nan::False();
    }

    g_value_unset(&gvalue);

    return MaybeLocal<v8::Boolean>(ret);
}

namespace ObjectClass {

static GObject* ClassConstructor(
    GType type, unsigned n_construct_properties,
    GObjectConstructParam* construct_properties) {

    /* FIXME: handle case where object is not constructed from
     * JS (eg Gtk.Builder) */

    /* The object is being constructed from JS:
     * Simply chain up to the first non-gjs constructor */
    GType parent_type = g_type_parent(type);

    while (G_OBJECT_CLASS(g_type_class_peek(parent_type))->constructor == ClassConstructor)
        parent_type = g_type_parent(parent_type);

    return G_OBJECT_CLASS(g_type_class_peek(parent_type))
        ->constructor(type, n_construct_properties, construct_properties);
}

static void ClassSetProperty(GObject* object, unsigned id, const GValue* value, GParamSpec* pspec) {}
static void ClassGetProperty(GObject* object, unsigned id, GValue* value, GParamSpec* pspec) {}

static void ClassInit(void* klass_pointer, void* data) {
    GObjectClass* klass = G_OBJECT_CLASS(klass_pointer);
    GType gtype = G_OBJECT_CLASS_TYPE(klass);

    klass->constructor = ClassConstructor;
    // klass->set_property = ClassSetProperty;
    // klass->get_property = ClassGetProperty;
}

constexpr GTypeFlags gobject_class_flags = (GTypeFlags)0;
constexpr GTypeInfo gobject_class_info = {
    /* interface types, classed types, instantiated types */
    0, // guint16                class_size;

    nullptr, // GBaseInitFunc          base_init;
    nullptr, // GBaseFinalizeFunc      base_finalize;

    /* interface types, classed types, instantiated types */
    ClassInit, // GClassInitFunc         class_init;
    GClassFinalizeFunc(nullptr), // GClassFinalizeFunc     class_finalize;
    nullptr,  // gconstpointer          class_data;

    /* instantiated types */
    0,       // guint16                instance_size;
    0,       // guint16                n_preallocs;
    nullptr, // GInstanceInitFunc      instance_init;

    /* value handling */
    nullptr, // const GTypeValueTable *value_table;
};

static void TypeQuerySafe(GType type, GTypeQuery* query) {
    while (g_type_get_qdata(type, GNodeJS::dynamic_type_quark()))
        type = g_type_parent(type);
    g_type_query(type, query);
}

static bool FindVFuncInfo(GType implementor_gtype,
                            GIBaseInfo* info, const char* name,
                            void** vtable,
                            GIFieldInfo** fieldInfoOut) {
    int i, length;
    bool result = false;

    *vtable = NULL;
    *fieldInfoOut = NULL;

    auto ancestorInfo = BaseInfo(g_base_info_get_container(info));
    auto ancestorGType = g_registered_type_info_get_g_type(*ancestorInfo);

    auto implementor_class = (GTypeInstance*) g_type_class_ref(implementor_gtype);
    BaseInfo structInfo;

    if (ancestorInfo.is(GI_INFO_TYPE_INTERFACE)) {
        auto implementor_iface_class =
            (GTypeInstance*) g_type_interface_peek(implementor_class,
                                                        ancestorGType);
        if (implementor_iface_class == NULL) {
            Nan::ThrowError("Couldn't find GType of implementor of interface.");
            result = false;
            goto out;
        }

        *vtable = implementor_iface_class;
        structInfo = g_interface_info_get_iface_struct(*ancestorInfo);
    } else {
        *vtable = implementor_class;
        structInfo = g_object_info_get_class_struct(*ancestorInfo);
    }

    length = g_struct_info_get_n_fields(*structInfo);
    for (i = 0; i < length; i++) {
        BaseInfo fieldInfo = g_struct_info_get_field(*structInfo, i);
        if (strcmp(fieldInfo.name(), name) != 0)
            continue;

        BaseInfo typeInfo = g_field_info_get_type(*fieldInfo);
        if (typeInfo.tag() != GI_TYPE_TAG_INTERFACE) {
            /* We have a field with the same name, but it's not a callback.
             * There's no hope of being another field with a correct name,
             * so just abort early. */
            result = true;
            goto out;
        } else {
            *fieldInfoOut = fieldInfo.ref();
            result = true;
            goto out;
        }
    }

out:
    g_type_class_unref(implementor_class);
    return result;
}


NAN_METHOD(RegisterClass) {
    auto jsKlassName  = Nan::To<String>(info[0]).ToLocalChecked();
    auto jsKlass      = info[1].As<Object>();
    auto jsParentName = Nan::To<String>(info[2]).ToLocalChecked();
    auto jsParent     = info[3].As<Object>();

    Nan::Utf8String utf8KlassName(jsKlassName);
    Nan::Utf8String utf8ParentName(jsParentName);
    auto parentType = g_type_from_name(*utf8ParentName);

    GTypeQuery query;
    TypeQuerySafe(parentType, &query);
    if (query.type == 0) {
        Nan::ThrowError("Failed to initialize type query");
        return;
    }

    GTypeFlags typeFlags = gobject_class_flags;
    GTypeInfo typeInfo = gobject_class_info;
    typeInfo.class_size = query.class_size;
    typeInfo.instance_size = query.instance_size;

    GType instanceType = g_type_register_static(
        parentType, *utf8KlassName, &typeInfo, typeFlags);

    g_type_set_qdata(instanceType, GNodeJS::dynamic_type_quark(), GINT_TO_POINTER(1));

    // FIXME: need to link klass destruction to GObjectClassDestroyed

    RETURN(v8::BigInt::NewFromUnsigned(Isolate::GetCurrent(), instanceType));
}

NAN_METHOD(RegisterVFunc) {
    auto jsVFuncInfo  = info[0].As<Object>();
    auto jsKlassGType = info[1].As<BigInt>();
    auto jsName       = info[2].As<String>();
    auto jsFunction   = info[3].As<Function>();

    Nan::Utf8String utf8Name(jsName);

    GType klassGType = jsKlassGType->Uint64Value();

    BaseInfo vfuncInfo(jsVFuncInfo);

    void *implementor_vtable;
    BaseInfo fieldInfo;
    if (!FindVFuncInfo(klassGType, *vfuncInfo, *utf8Name,
            &implementor_vtable, &fieldInfo))
        return;

    if (fieldInfo.isEmpty())
        return;

    auto offset = g_field_info_get_offset(*fieldInfo);

    /* Abort if vfunc offset not found */
    if (offset == OFFSET_NOT_FOUND)
        ERROR("Virtual function offset not found (%s.%s)",
                g_type_name(klassGType), vfuncInfo.name());

    auto functionPtr = G_STRUCT_MEMBER_P(implementor_vtable, offset);
    auto callback = new Callback(jsFunction, *vfuncInfo, GI_SCOPE_TYPE_NOTIFIED);
    StoreVFunc(klassGType, callback);

    *reinterpret_cast<ffi_closure**>(functionPtr) = callback->closure;

    RETURN(true);
    return;
}

};

};
