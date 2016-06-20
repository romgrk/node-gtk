
#include "boxed.h"
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

static void GObjectDestroyed(const v8::WeakCallbackInfo<GObject> &data);
static Local<FunctionTemplate> GetClassTemplateFromGI(GIBaseInfo *info);

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

static void GObjectDestroyed(const v8::WeakCallbackInfo<GObject> &data) {
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

static void GObjectClassDestroyed(const v8::WeakCallbackInfo<GIBaseInfo> &data) {
    GIBaseInfo *info = data.GetParameter ();
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);

    void *type_data = g_type_get_qdata (gtype, GNodeJS::template_quark());

    assert (type_data != NULL);

    Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) type_data;
    delete persistent;

    g_type_set_qdata (gtype, GNodeJS::template_quark(), NULL);
    g_base_info_unref (info);
}


static void SignalConnectInternal(const Nan::FunctionCallbackInfo<v8::Value> &args, bool after) {
    Isolate *isolate = args.GetIsolate ();
    GObject *gobject = GObjectFromWrapper (args.This ());

    if (!(args[0]->IsString() || args[0]->IsNumber())) {
        Nan::ThrowTypeError("Signal ID invalid.");
        return;
    }

    if (!args[1]->IsFunction()) {
        Nan::ThrowTypeError("Signal callback is not a function.");
        return;
    }

    String::Utf8Value signal_name (args[0]->ToString ());
    Local<Function> callback = args[1].As<Function>();

    GClosure *gclosure = MakeClosure (isolate, callback);

    // TODO return some sort of cancellation handle?
    // e.g.: return { disposable: function () {...}, signal_id: ID };
    ulong handler_id = g_signal_connect_closure (gobject, *signal_name, gclosure, after);
    args.GetReturnValue().Set((double)handler_id);
}

NAN_METHOD(SignalConnect) {
    SignalConnectInternal(info, false);
}


static Local<FunctionTemplate> GetBaseClassTemplate() {
    static int count = 0;
    g_warning("GetBaseClassTemplate called (%i)", count);
    count++;
    auto tpl = New<FunctionTemplate> ();
    Nan::SetPrototypeMethod(tpl, "on", SignalConnect);
    Nan::SetPrototypeMethod(tpl, "connect", SignalConnect);
    Nan::SetPrototypeMethod(tpl, "addEventListener", SignalConnect);
    Nan::SetPrototypeMethod(tpl, "toString",
            [](const Nan::FunctionCallbackInfo<v8::Value>& info) -> void {
                char *str = *String::Utf8Value(info.This()->GetConstructorName());
                info.GetReturnValue().Set(UTF8(str));
            });
    return tpl;
}

static Local<FunctionTemplate> NewClassTemplate (GIBaseInfo *info) {
    const GType gtype = g_registered_type_info_get_g_type (info);

    g_assert(gtype != G_TYPE_NONE);

    const char *class_name = g_type_name (gtype);

    auto tpl = New<FunctionTemplate> (GObjectConstructor, New<External> (info));
    //tpl->Set (UTF8("gtype"), New((double)gtype));
    Nan::SetTemplate(tpl, "gtype", New((double)gtype));
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
    // GIBaseInfo *info,
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
                GObjectClassDestroyed,
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
        Local<Object> obj = constructor->NewInstance (1, args);

        return obj;
    }
}

GObject * GObjectFromWrapper(Local<Value> value) {
    Local<Object> object = value->ToObject ();

    void    *ptr     = object->GetAlignedPointerFromInternalField (0);
    GObject *gobject = G_OBJECT (ptr);
    return gobject;
}

};
