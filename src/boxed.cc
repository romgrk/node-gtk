
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

        bool success = g_field_info_get_field(field, boxed, &value);

        if (success) {
            GITypeInfo  *field_type = g_field_info_get_type(field);
            const char  *fieldName  = g_base_info_get_name(field);

            self->Set( UTF8(fieldName), GIArgumentToV8(field_type, &value));

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
                auto p_tpl = tpl->PrototypeTemplate();

                Nan::Set(self, UTF8("__p_tpl__"), p_tpl->NewInstance());

                g_base_info_unref(union_type);
            }

            g_base_info_unref(union_info);
            g_base_info_unref(union_field);

            g_base_info_unref(field_type);
        }

        g_base_info_unref(field);

        //if (success) break;
    }

}

static void BoxedClassDestroyed(const v8::WeakCallbackInfo<GIBaseInfo> &data) {
    GIBaseInfo *info  = data.GetParameter ();
    GType       gtype = g_registered_type_info_get_g_type (info);

    WARN("BoxedClassDestroyed: %s", g_base_info_get_name(info));

    if (GI_IS_STRUCT_INFO(info)) {
        //int n_fields = g_struct_info_get_n_fields(info);
        //for (int i = 0; i < n_fields; ++i) {
            //GIFieldInfo *field = g_struct_info_get_field(info, i);
            //g_base_info_unref(field);
        //}
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
            DEBUG("union gi_info: %s", g_base_info_get_name(gi_info));
            //InitBoxedFromUnion(self, gi_info);
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

Local<FunctionTemplate> GetBoxedTemplate(GIBaseInfo *info, GType gtype) {
    void *data = NULL;

    if (gtype != G_TYPE_NONE)
        data = g_type_get_qdata(gtype, GNodeJS::template_quark());

    if (data) {
        Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) data;
        Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate> (*persistent);
        return tpl;

    } else {

        auto tpl = New<FunctionTemplate>(
            BoxedConstructor, New<External>(info));

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
            //int n_fields = g_struct_info_get_n_fields(info);
            //for (int i = 0; i < n_fields; i++) {
                //GIFieldInfo *field = g_struct_info_get_field(info, i);
                //const char  *name  = g_base_info_get_name(field);
                ////char *jsName = Util::toCamelCase(name);

                //Nan::SetAccessor(
                        //tpl->InstanceTemplate(),
                        //UTF8(name), //UTF8(jsName),
                        //FieldGetter,
                        //FieldSetter,
                        //Nan::New<External>(field));

                ////g_base_info_unref (field);
            //}

        } else if (GI_IS_UNION_INFO(info)) {

        } else {
            print_info(info);
            g_assert_not_reached();
        }

        if (gtype == G_TYPE_NONE)
            return tpl;

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
