
#include "boxed.h"
#include "debug.h"
#include "function.h"
#include "gobject.h"
#include "value.h"

using namespace v8;

namespace GNodeJS {

struct Boxed {
    gpointer    pointer; // XXX usage?
    GIBaseInfo *info;
};

static G_DEFINE_QUARK(gnode_js_template, gnode_js_template);

static void InitBoxedFromStruct (Isolate *isolate, Local<Object> self, GIStructInfo *info) {
    gpointer pointer = self->GetAlignedPointerFromInternalField(0);

    int n_fields = g_struct_info_get_n_fields(info);
    for (int i = 0; i < n_fields; i++) {
        GIFieldInfo *field    = g_struct_info_get_field(info, i);
        const char *fieldName = g_base_info_get_name(field);
        GIArgument value;

        if (g_field_info_get_field(field, pointer, &value)) {
            GITypeInfo  *fieldType = g_field_info_get_type(field);

            self->Set( UTF8(fieldName),
                    GIArgumentToV8(isolate, fieldType, &value));

            g_base_info_unref (fieldType);
        }

        g_base_info_unref (field);
    }

    int n_methods = g_struct_info_get_n_methods(info);
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *func_info = g_struct_info_get_method(info, i);
        GIFunctionInfoFlags flags = g_function_info_get_flags(func_info);

        if ((flags & GI_FUNCTION_IS_METHOD) &&
                !(flags & GI_FUNCTION_IS_CONSTRUCTOR))
            self->Set( UTF8_NAME(func_info),
                    MakeFunction(isolate, func_info));

        g_base_info_unref(func_info);
    }
}

static void InitBoxedFromUnion (Isolate *isolate, Local<Object> self, GIUnionInfo *info) {

    void *boxed = self->GetAlignedPointerFromInternalField(0);

    // XXX is there a standard way to get the type?
    gint n_fields = g_union_info_get_n_fields(info);
    for (int i = 0; i < n_fields; i++) {
        GIArgument   value;
        GIFieldInfo *field = g_union_info_get_field(info, i);

        if (g_field_info_get_field(field, boxed, &value)) {
            GITypeInfo  *type  = g_field_info_get_type(field);
            const char  *fieldName = g_base_info_get_name(field);

            self->Set( UTF8(fieldName),
                    GIArgumentToV8(isolate, type, &value));

            GIStructInfo *union_type;
            GIFieldInfo *union_field;
            GITypeInfo *union_info;

            union_field = g_union_info_get_field(info, value.v_int);
            union_info  = g_field_info_get_type(union_field);
            union_type  = g_type_info_get_interface(union_info);

            InitBoxedFromStruct(isolate, self, union_type);

            g_base_info_unref(union_type);
            g_base_info_unref(union_info);
            g_base_info_unref(union_field);

            g_base_info_unref(field);
            g_base_info_unref(type);
        }
    }

    // XXX is this correct?
    gint n_methods = g_union_info_get_n_methods(info);
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *func_info = g_union_info_get_method(info, i);
        GIFunctionInfoFlags flags = g_function_info_get_flags(func_info);

        if ((flags & GI_FUNCTION_IS_METHOD)
            && !(flags & GI_FUNCTION_IS_CONSTRUCTOR))
            self->Set( UTF8_NAME(func_info), MakeFunction(isolate, func_info));

        g_base_info_unref (func_info);
    }
}

static void BoxedClassDestroyed(const WeakCallbackData<FunctionTemplate, GIBaseInfo> &data) {
    GIBaseInfo *info = data.GetParameter ();
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);

    void *type_data = g_type_get_qdata (gtype, gnode_js_template_quark ());
    assert (type_data != NULL);
    Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) type_data;
    delete persistent;

    g_type_set_qdata (gtype, gnode_js_template_quark (), NULL);
    g_base_info_unref (info);
}

static void BoxedConstructor(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate ();

    /* See gobject.cc for how this works */

    if (!args.IsConstructCall ()) {
        ThrowTypeError("Not a construct call");
        return;
    }

    Local<Object> self = args.This ();

    if (args[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromBoxed is called. */

        /* XXX: We might want to copy the boxed? */
        void *boxed = External::Cast (*args[0])->Value ();
        self->SetAlignedPointerInInternalField (0, boxed);

        GIBaseInfo *base_info;
        GIInfoType  info_type;

        base_info = (GIBaseInfo *) External::Cast (*args.Data ())->Value ();
        info_type = g_base_info_get_type (base_info);

        if (info_type == GI_INFO_TYPE_STRUCT) {
            InitBoxedFromStruct(isolate, self, base_info);
        } else if (info_type == GI_INFO_TYPE_UNION) {
            InitBoxedFromUnion(isolate, self, base_info);
        } else {
            print_info(base_info);
            g_assert_not_reached();
        } /* FIXME if (info_type == GI_INFO_TYPE_INTERFACE) ?  */

    } else {
        /* TODO: Boxed construction not supported yet. */
        g_assert_not_reached ();
    }
}

static Local<FunctionTemplate> GetBoxedTemplate(Isolate *isolate, GIBaseInfo *info, GType gtype) {
    void  *data = g_type_get_qdata (gtype, gnode_js_template_quark ());

    if (data) {
        Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) data;
        Local<FunctionTemplate> tpl = Local<FunctionTemplate>::New (isolate, *persistent);
        return tpl;
    } else {
        Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate,
                BoxedConstructor,
                External::New (isolate, info));

        Persistent<FunctionTemplate> *persistent = new Persistent<FunctionTemplate>(isolate, tpl);
        persistent->SetWeak( g_base_info_ref(info), BoxedClassDestroyed);
        g_type_set_qdata (gtype, gnode_js_template_quark (), persistent);

        // g_type_name(gtype) ? FIXME
        const char *class_name = g_base_info_get_name (info);
        tpl->SetClassName (String::NewFromUtf8 (isolate, class_name));

        tpl->InstanceTemplate ()->SetInternalFieldCount (1);

        return tpl;
    }
}

static Local<FunctionTemplate> GetBoxedTemplateFromGI(Isolate *isolate, GIBaseInfo *info) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);
    return GetBoxedTemplate (isolate, info, gtype);
}

Handle<Function> MakeBoxed(Isolate *isolate, GIBaseInfo *info) {
    Local<FunctionTemplate> tpl = GetBoxedTemplateFromGI (isolate, info);
    return tpl->GetFunction ();
}

Local<Value> WrapperFromBoxed(Isolate *isolate, GIBaseInfo *info, void *data) {
    Local<Function> constructor = MakeBoxed (isolate, info);

    Local<Value> boxed_external = External::New (isolate, data);
    Local<Value> args[] = { boxed_external };
    Local<Object> obj = constructor->NewInstance (1, args);
    return obj;
}

void * BoxedFromWrapper(Local<Value> value) {
    Handle<Object> object = value->ToObject ();
    void *data = object->GetAlignedPointerFromInternalField (0);
    return data;
}

};
