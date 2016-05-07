
#include <girepository.h>
#include <glib.h>

#include "boxed.h"
#include "debug.h"
#include "function.h"
#include "gi.h"
#include "gobject.h"
#include "util.h"
#include "value.h"

using v8::Array;
using v8::External;
using v8::Function;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
//using v8::WeakCallbackInfo;
using v8::Persistent;
using Nan::New;
using Nan::WeakCallbackType;

namespace GNodeJS {

struct Boxed {
    void       *data;
    GIBaseInfo *info;
};

/*
 *Local<FunctionTemplate> BoxedTemplate::Get (GIBaseInfo *gi_info) {
 *    GType gtype = g_registered_type_info_get_g_type (gi_info);
 *
 *    g_assert(gtype != G_TYPE_NONE);
 *
 *    void *data = g_type_get_qdata(gtype, GNodeJS::template_quark());
 *
 *    if (data) {
 *        Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) data;
 *        Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate> (*persistent);
 *        return tpl;
 *
 *    } else {
 *
 *        GIBaseInfo *info = g_irepository_find_by_gtype (NULL, gtype);
 *        Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate> (
 *            BoxedTemplate::BoxedTemplate, Nan::New<External> (info));
 *
 *        const char *class_name = g_type_name(gtype);
 *        tpl->SetClassName( UTF8(class_name) );
 *        tpl->InstanceTemplate()->SetInternalFieldCount(1);
 *        tpl->Set(UTF8("gtype"), Nan::New<Number>(gtype));
 *
 *        if (GI_IS_STRUCT_INFO(info)) {
 *            int n_methods = g_struct_info_get_n_methods(info);
 *            for (int i = 0; i < n_methods; i++) {
 *                GIFunctionInfo *func_info = g_struct_info_get_method(info, i);
 *                InstallFunction(tpl, func_info);
 *                g_base_info_unref(func_info);
 *            }
 *            int n_fields = g_struct_info_get_n_fields(info);
 *            for (int i = 0; i < n_fields; i++) {
 *                GIFieldInfo *field = g_struct_info_get_field(info, i);
 *                const char* name = g_base_info_get_name(field);
 *                //char *jsName = Util::toCamelCase(name);
 *                Nan::SetAccessor(
 *                        tpl->PrototypeTemplate(),
 *                        UTF8(name), //UTF8(jsName),
 *                        FieldGetter,
 *                        FieldSetter,
 *                        Nan::New<External> (field));
 *                g_base_info_unref (field);
 *            }
 *            GIBaseInfo *container = g_base_info_get_container(info);
 *            if (container != NULL) {
 *                DEBUG("Struct container: %s", g_base_info_get_name(container));
 *            }
 *
 *        } else if (GI_IS_UNION_INFO(info)) {
 *            int n_methods = g_union_info_get_n_methods(info);
 *            for (int i = 0; i < n_methods; i++) {
 *                GIFunctionInfo *func_info = g_union_info_get_method(info, i);
 *                InstallFunction(tpl, func_info);
 *                g_base_info_unref (func_info);
 *            }
 *        } else {
 *            print_info(info);
 *            g_assert_not_reached();
 *        }
 *
 *        if (g_type_parent(gtype) != G_TYPE_BOXED) {
 *            DEBUG("GetBoxedTemplate: parent != BOXED for %s", g_type_name(gtype));
 *        }
 *
 *        Isolate *isolate = Isolate::GetCurrent();
 *        auto *persistent = new v8::Persistent<FunctionTemplate>(isolate, tpl);
 *        persistent->SetWeak(
 *                g_base_info_ref(info),
 *                BoxedClassDestroyed,
 *                WeakCallbackType::kParameter);
 *
 *        g_type_set_qdata(gtype, GNodeJS::template_quark(), persistent);
 *
 *        return tpl;
 *    }
 *}
 */

/*
 *static void InitBoxedFromStruct (Local<Object> self, GIStructInfo *info) {
 *    gpointer pointer = self->GetAlignedPointerFromInternalField(0);
 *
 *    int n_fields = g_struct_info_get_n_fields(info);
 *    for (int i = 0; i < n_fields; i++) {
 *        GIFieldInfo *field    = g_struct_info_get_field(info, i);
 *        const char *fieldName = g_base_info_get_name(field);
 *        GIArgument value;
 *
 *        if (g_field_info_get_field(field, pointer, &value)) {
 *            GITypeInfo  *fieldType = g_field_info_get_type(field);
 *            char *_name = g_strdup_printf("_%s", fieldName);
 *
 *            self->Set(
 *                UTF8(_name),
 *                GIArgumentToV8(fieldType, &value));
 *
 *            g_base_info_unref (fieldType);
 *            g_free(_name);
 *        }
 *
 *        g_base_info_unref (field);
 *    }
 *}
 */

static void InitBoxedFromUnion (Local<Object> self, GIUnionInfo *info) {
    void *boxed = self->GetAlignedPointerFromInternalField(0);

    int n_fields = g_union_info_get_n_fields(info);
    for (int i = 0; i < n_fields; i++) {
        GIArgument   value;
        GIFieldInfo *field = g_union_info_get_field(info, i);
        //GIConstantInfo *field_d = g_union_info_get_discriminator(info, i);
        bool success = g_field_info_get_field(field, boxed, &value);

        if (success) {
            GITypeInfo  *type  = g_field_info_get_type(field);
            const char  *fieldName = g_base_info_get_name(field);

            self->Set( UTF8(fieldName), GIArgumentToV8(type, &value));

            GIStructInfo *union_type;
            GIFieldInfo *union_field;
            GITypeInfo *union_info;

            union_field = g_union_info_get_field(info, value.v_int);
            union_info  = g_field_info_get_type(union_field);

            GITypeTag tag = g_type_info_get_tag(union_info);

            if (tag == GI_TYPE_TAG_INTERFACE) {
                union_type  = g_type_info_get_interface(union_info);
                GType gtype = g_registered_type_info_get_g_type(union_type);

                auto tpl = GetBoxedTemplate(union_type, gtype);
                //Local<Function> constructor = tpl->GetFunction();
                auto p_tpl = tpl->PrototypeTemplate()->NewInstance();

                Nan::Set(self, UTF8("__proto__"), p_tpl);

                g_base_info_unref(union_type);
            }

            g_base_info_unref(union_info);
            g_base_info_unref(union_field);

            g_base_info_unref(type);
        }

        g_base_info_unref(field);

        if (success)
            break;
    }

}

static void BoxedClassDestroyed(const v8::WeakCallbackInfo<GIBaseInfo> &data) {
    GIBaseInfo *info  = data.GetParameter ();
    GType       gtype = g_registered_type_info_get_g_type (info);

    WARN("BoxedClassDestroyed: %s", g_base_info_get_name(info));

    if (GI_IS_STRUCT_INFO(info)) {
        int n_fields = g_struct_info_get_n_fields(info);
        for (int i = 0; i < n_fields; ++i) {
            GIFieldInfo *field = g_struct_info_get_field(info, i);
            g_base_info_unref(field);
        }
    }

    if (gtype != G_TYPE_NONE) {
        void *type_data = g_type_get_qdata (gtype, GNodeJS::template_quark());

        assert (type_data != NULL);

        Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) type_data;
        delete persistent;

        g_type_set_qdata (gtype, GNodeJS::template_quark(), NULL);
    }

    g_base_info_unref (info);
}

static void BoxedConstructor(const Nan::FunctionCallbackInfo<Value> &args) {
    /* See gobject.cc for how this works */

    if (!args.IsConstructCall ()) {
        Nan::ThrowTypeError("Not a construct call");
        return;
    }

    Local<Object> self = args.This ();

    if (args[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromBoxed is called. */

        void *data = External::Cast(*args[0])->Value();

        GIBaseInfo *gi_info = (GIBaseInfo *) External::Cast (*args.Data ())->Value ();

        // FIXME ? void *boxed = g_boxed_copy(g_type, data);
        self->SetAlignedPointerInInternalField (0, data);

        GIInfoType type = g_base_info_get_type (gi_info);

        if (type == GI_INFO_TYPE_UNION)
            InitBoxedFromUnion(self, gi_info);
        else
            g_assert(type == GI_INFO_TYPE_STRUCT);

    } else {
        /* TODO: Boxed construction not supported yet. */
        g_assert_not_reached ();
    }
}


NAN_GETTER(FieldGetter) {
    // Local<v8::String> property
    Local<Object> self = info.This();
    External     *data = External::Cast(*info.Data());

    g_assert(self->InternalFieldCount() > 0);

    void *boxed = self->GetAlignedPointerFromInternalField(0);

    if (boxed == NULL) {
        g_warning("FieldGetter: NULL boxed pointer");
        info.GetReturnValue().SetUndefined();
        return;
    }

    GIFieldInfo *field = static_cast<GIFieldInfo*>(data->Value());

    g_assert(field);

    GIArgument value;

    if (g_field_info_get_field(field, boxed, &value)) {
        GITypeInfo  *field_type = g_field_info_get_type(field);
        info.GetReturnValue().Set(
                GIArgumentToV8(field_type, &value));
        g_base_info_unref (field_type);
    } else {
        DEBUG("FieldGetter: couldnt get field %s", g_base_info_get_name(field));
        DEBUG("FieldGetter: property name: %s", *Nan::Utf8String(property) );
        info.GetReturnValue().SetUndefined();
    }
    // FIXME free GIArgument?
}

NAN_SETTER(FieldSetter) {
    // Local<v8::String> property
    // Local<v8::Value>  value
    //Isolate *isolate = info.GetIsolate();
    Local<Object> self = info.This();

    g_assert(self->InternalFieldCount() > 0);

    void *boxed = self->GetAlignedPointerFromInternalField(0);
    GIFieldInfo *field = static_cast<GIFieldInfo*>(External::Cast(*info.Data())->Value());
    GITypeInfo  *field_type = g_field_info_get_type(field);

    g_assert(boxed);
    g_assert(field);
    g_assert(field_type);

    GIArgument arg;

    if (V8ToGIArgument(field_type, &arg, value, true)) {
        if (g_field_info_set_field(field, boxed, &arg) == FALSE)
            DEBUG("FieldSetter: couldnt set field %s", g_base_info_get_name(field));
        FreeGIArgument(field_type, &arg);
    } else {
        DEBUG("FieldSetter: couldnt convert value for field %s", g_base_info_get_name(field));
    }

    // FIXME free GIArgument?
    g_base_info_unref (field_type);
}

class MyStructObject : public Nan::ObjectWrap {
  public:
    static NAN_MODULE_INIT(Init) {
        v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
        tpl->SetClassName(Nan::New("MyStructObject").ToLocalChecked());
        tpl->InstanceTemplate()->SetInternalFieldCount(1);

        SetPrototypeMethod(tpl, "getHandle", GetHandle);
        SetPrototypeMethod(tpl, "getValue", GetValue);

        constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());
        Nan::Set(target, Nan::New("MyStructObject").ToLocalChecked(),
            Nan::GetFunction(tpl).ToLocalChecked());
    }

    static Local<FunctionTemplate> GetTemplate (GIBaseInfo *info) {
        auto tpl = Nan::New<FunctionTemplate>(New);
        tpl->SetClassName(Nan::New("MyStructObject").ToLocalChecked());
        tpl->InstanceTemplate()->SetInternalFieldCount(1);

        SetPrototypeMethod(tpl, "getHandle", GetHandle);
        SetPrototypeMethod(tpl, "getValue", GetValue);

        constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());

        return tpl;
    }

  private:
    explicit MyStructObject(double value = 0) : _value(value) {}

    explicit MyStructObject(GIBaseInfo *info) {
        _info = g_base_info_ref(info);
    }

    ~MyStructObject() {
        g_base_info_unref(_info);
    }

    double      _value;
    void       *_data;
    GIBaseInfo *_info;

    static NAN_METHOD(New) {
        if (info.IsConstructCall()) {
            double value = info[0]->IsUndefined() ? 0 : Nan::To<double>(info[0]).FromJust();
            MyStructObject *obj = new MyStructObject(value);
            obj->Wrap(info.This());
            info.GetReturnValue().Set(info.This());
        } else {
            const int argc = 1;
            v8::Local<v8::Value> argv[argc] = {info[0]};
            v8::Local<v8::Function> cons = Nan::New(constructor());
            info.GetReturnValue().Set(cons->NewInstance(argc, argv));
        }
    }

    static NAN_METHOD(GetHandle) {
        MyStructObject* obj = Nan::ObjectWrap::Unwrap<MyStructObject>(info.Holder());
        info.GetReturnValue().Set(obj->handle());
    }

    static NAN_METHOD(GetValue) {
        MyStructObject* obj = Nan::ObjectWrap::Unwrap<MyStructObject>(info.Holder());
        info.GetReturnValue().Set(obj->_value);
    }

    static inline Nan::Persistent<v8::Function> & constructor() {
        static Nan::Persistent<v8::Function> my_constructor;
        return my_constructor;
    }
};

class MyFactoryObject : public Nan::ObjectWrap {
  public:
    static NAN_MODULE_INIT(Init) {
        v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(New);
        tpl->InstanceTemplate()->SetInternalFieldCount(1);

        Nan::SetPrototypeMethod(tpl, "getValue", GetValue);

        constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());
    }

    static NAN_METHOD(NewInstance) {
        v8::Local<v8::Function> cons = Nan::New(constructor());
        double value = info[0]->IsNumber() ? Nan::To<double>(info[0]).FromJust() : 0;
        const int argc = 1;
        v8::Local<v8::Value> argv[1] = {Nan::New(value)};
        info.GetReturnValue().Set(Nan::NewInstance(cons, argc, argv).ToLocalChecked());
    }

    // Needed for the next example:
    inline double value() const {
        return _value;
    }

private:
    explicit MyFactoryObject(double value = 0) : _value(value) {}
    ~MyFactoryObject() {}

    static NAN_METHOD(New) {
        if (info.IsConstructCall()) {
            double value = info[0]->IsNumber() ? Nan::To<double>(info[0]).FromJust() : 0;
            MyFactoryObject * obj = new MyFactoryObject(value);
            obj->Wrap(info.This());
            info.GetReturnValue().Set(info.This());
        } else {
            const int argc = 1;
            v8::Local<v8::Value> argv[argc] = {info[0]};
            v8::Local<v8::Function> cons = Nan::New(constructor());
            info.GetReturnValue().Set(Nan::NewInstance(cons, argc, argv).ToLocalChecked());
        }
    }

    static NAN_METHOD(GetValue) {
        MyFactoryObject* obj = ObjectWrap::Unwrap<MyFactoryObject>(info.Holder());
        info.GetReturnValue().Set(obj->_value);
    }

    static inline Nan::Persistent<v8::Function> & constructor() {
        static Nan::Persistent<v8::Function> my_constructor;
        return my_constructor;
    }

    double _value;
};

Local<FunctionTemplate> MakeStructTemplate(GIBaseInfo *info) {

    auto tpl = New<FunctionTemplate>(
        BoxedConstructor, New<External>(info) );

    const char *class_name = g_base_info_get_name (info);
    tpl->SetClassName( UTF8(class_name) );
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    int n_methods = g_struct_info_get_n_methods(info);
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *func_info = g_struct_info_get_method(info, i);
        InstallFunction(tpl, func_info);
        g_base_info_unref(func_info);
    }
    int n_fields = g_struct_info_get_n_fields(info);
    for (int i = 0; i < n_fields; i++) {
        GIFieldInfo *field = g_struct_info_get_field(info, i);
        const char  *name  = g_base_info_get_name(field);
        //char *jsName = Util::toCamelCase(name);

        Nan::SetAccessor(
                tpl->InstanceTemplate(),
                UTF8(name), //UTF8(jsName),
                FieldGetter,
                FieldSetter,
                Nan::New<External>(field));

        //g_base_info_unref (field);
    }

    //GType parent = g_type_parent (gtype);
    GIBaseInfo *parent_info = g_irepository_find_by_gtype (NULL, parent);
    g_assert(parent_info != NULL);
    Local<FunctionTemplate> p_tpl = GetBoxedTemplate(parent_info, parent);
    tpl->Inherit(p_tpl);

    Isolate *isolate = Isolate::GetCurrent();
    auto *persistent = new v8::Persistent<FunctionTemplate>(isolate, tpl);
    persistent->SetWeak(
            g_base_info_ref(info),
            BoxedClassDestroyed,
            WeakCallbackType::kParameter);

    return tpl;
}

Local<FunctionTemplate> GetBoxedTemplate(GIBaseInfo *info, GType gtype) {
    void *data = NULL;

    if (gtype != G_TYPE_NONE)
        data = g_type_get_qdata(gtype, GNodeJS::template_quark());

    if (data) {
        Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) data;
        Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate> (*persistent);
        return tpl;
    } else {

        auto tpl = New<FunctionTemplate> (
            BoxedConstructor, New<External> (info));

        if (gtype != G_TYPE_NONE) {
            const char *class_name = g_type_name(gtype);
            tpl->SetClassName( UTF8(class_name) );
            tpl->Set(UTF8("gtype"), Nan::New<Number>(gtype));
        } else {
            const char *class_name = g_base_info_get_name (info);
            tpl->SetClassName( UTF8(class_name) );
        }

        tpl->InstanceTemplate()->SetInternalFieldCount(1);

        if (GI_IS_STRUCT_INFO(info)) {
            int n_methods = g_struct_info_get_n_methods(info);
            for (int i = 0; i < n_methods; i++) {
                GIFunctionInfo *func_info = g_struct_info_get_method(info, i);
                InstallFunction(tpl, func_info);
                g_base_info_unref(func_info);
            }
            int n_fields = g_struct_info_get_n_fields(info);
            for (int i = 0; i < n_fields; i++) {
                GIFieldInfo *field = g_struct_info_get_field(info, i);
                const char  *name  = g_base_info_get_name(field);
                //char *jsName = Util::toCamelCase(name);

                Nan::SetAccessor(
                        tpl->InstanceTemplate(),
                        UTF8(name), //UTF8(jsName),
                        FieldGetter,
                        FieldSetter,
                        Nan::New<External>(field));

                //g_base_info_unref (field);
            }

            GIBaseInfo *container = g_base_info_get_container(info);
            if (container != NULL)
                DEBUG("Struct container: %s", g_base_info_get_name(container));

        } else if (GI_IS_UNION_INFO(info)) {
            int n_methods = g_union_info_get_n_methods(info);
            for (int i = 0; i < n_methods; i++) {
                GIFunctionInfo *func_info = g_union_info_get_method(info, i);
                InstallFunction(tpl, func_info);
                g_base_info_unref (func_info);
            }
        } else {
            print_info(info);
            g_assert_not_reached();
        }

        if (gtype == G_TYPE_NONE)
            return tpl;

        GType parent = g_type_parent (gtype);
        while (G_TYPE_IS_FUNDAMENTAL(parent) == FALSE) {
            DEBUG("GetBoxedTemplate: parent != BOXED for %s", g_type_name(gtype));
            GIBaseInfo *parent_info = g_irepository_find_by_gtype (NULL, parent);

            g_assert(parent_info != NULL);

            Local<FunctionTemplate> p_tpl = GetBoxedTemplate(parent_info, parent);
            tpl->Inherit(p_tpl);

            parent = g_type_parent (parent);
        }

        Isolate *isolate = Isolate::GetCurrent();
        auto *persistent = new v8::Persistent<FunctionTemplate>(isolate, tpl);
        persistent->SetWeak(
                g_base_info_ref(info),
                BoxedClassDestroyed,
                WeakCallbackType::kParameter);

        g_type_set_qdata(gtype, GNodeJS::template_quark(), persistent);

        return tpl;
    }
}

static Local<FunctionTemplate> GetBoxedTemplateFromGI(GIBaseInfo *info) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);
    if (gtype == G_TYPE_NONE) {
        g_warning("GetBoxedTemplateFromGI: gtype == G_TYPE_NONE for %s",
                g_base_info_get_name(info));
    } else {
        g_type_ensure(gtype);
    }
    return GetBoxedTemplate (info, gtype);
}

Local<Function> MakeBoxed(GIBaseInfo *info) {
    Local<FunctionTemplate> tpl = GetBoxedTemplateFromGI (info);
    return tpl->GetFunction ();
}

Local<Value> WrapperFromBoxed(GIBaseInfo *info, void *data) {
    Local<Function> constructor = MakeBoxed (info);

    Local<Value> boxed_external = Nan::New<External> (data);
    Local<Value> args[] = { boxed_external };
    Local<Object> obj = constructor->NewInstance (1, args);
    return obj;
}

void * BoxedFromWrapper(Local<Value> value) {
    Local<Object> object = value->ToObject ();

    if (object->InternalFieldCount() == 0) {
        g_warning("BoxedFromWrapper: internal field count == 0");
        return NULL;
    }

    void *boxed = object->GetAlignedPointerFromInternalField(0);
    return boxed;
}

};
