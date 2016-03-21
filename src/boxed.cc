
#include "boxed.h"
#include "debug.h"
#include "function.h"
#include "gobject.h"
#include "value.h"

#define UTF8(s) String::NewFromUtf8(isolate, s)
#define UTF8_NAME(s) String::NewFromUtf8(isolate, g_base_info_get_name(s))

using namespace v8;

namespace GNodeJS {

struct Boxed {
    gpointer    pointer;
    GIBaseInfo *info;
};

static G_DEFINE_QUARK(gnode_js_template, gnode_js_template);

static Handle<Value>
GetFieldValue ( Isolate *isolate, gpointer pointer, GIFieldInfo *field) {
  GITypeInfo  *fieldType = g_field_info_get_type(field);
  GITypeTag    fieldTag  = g_type_info_get_tag(fieldType);
  GIArgument   value;
  gint         offset;
  Handle<Value> ret;

  if (g_field_info_get_field(field, pointer, &value)) {
    ret = GIArgumentToV8(isolate, fieldType, &value);

  } else if (fieldTag == GI_TYPE_TAG_INTERFACE) {
    offset = g_field_info_get_offset (field); // XXX Use this
    printf("field: %s \t offset: %i", g_base_info_get_name(field), offset);

    GIBaseInfo *i_info = g_type_info_get_interface(fieldType);
    GIInfoType  i_type = g_base_info_get_type(i_info);
    print_info (i_info);

    switch (i_type) {
    case GI_INFO_TYPE_OBJECT:
        ret = WrapperFromGObject (isolate, i_info, (GObject *)(pointer + offset));
        break;
    case GI_INFO_TYPE_BOXED:
    case GI_INFO_TYPE_STRUCT:
    case GI_INFO_TYPE_UNION:
        ret = WrapperFromBoxed (isolate, i_info, (pointer + offset));
        break;
    case GI_INFO_TYPE_FLAGS:
    case GI_INFO_TYPE_ENUM:
        ret = Integer::New (isolate, value.v_int);
        break;
    default:
        g_assert_not_reached ();
    }
    g_base_info_unref(i_info);

  } else if (fieldTag == GI_TYPE_TAG_UTF8) {
    ret = UTF8((char *)value.v_pointer);

  } else {
    ret = GIArgumentToV8(isolate, fieldType, &value);
  }

  g_base_info_unref(fieldType);
  return ret;
}

static void InitBoxedFromInterface (Isolate *isolate, Local<Object> self, GIInterfaceInfo *info, void *boxed) {
    gint n_props = g_interface_info_get_n_properties(info);
    gint n_methods = g_interface_info_get_n_methods(info);

    for (int i = 0; i < n_props; i++) {
        //GIArgument value;
        GIPropertyInfo *prop = g_interface_info_get_property(info, i);
        GITypeInfo *type = g_property_info_get_type(prop);

        //if (g_field_info_get_field(prop, boxed, &value))
            //self->Set( UTF8(g_base_info_get_name(prop)),
                    //GIArgumentToV8(isolate, type, &value));

        g_base_info_unref (prop);
        g_base_info_unref (type);
    }

    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *func_info = g_interface_info_get_method(info, i);
        self->Set(
                UTF8(g_base_info_get_name(func_info)),
                MakeFunction(isolate, func_info));

        g_base_info_unref (func_info);
    }
}

static void InitBoxedFromStruct (Isolate *isolate, Local<Object> self, GIStructInfo *info) {
    gint n_fields = g_struct_info_get_n_fields(info);
    gint n_methods = g_struct_info_get_n_methods(info);

    gpointer pointer = self->GetAlignedPointerFromInternalField(0);

    for (int i = 0; i < n_fields; i++) {
        GIFieldInfo *field    = g_struct_info_get_field(info, i);
        const char *fieldName = g_base_info_get_name(field);
        self->Set( UTF8(fieldName),
            GetFieldValue(isolate, pointer, field));
        g_base_info_unref (field);
    }

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
    gint n_fields = g_union_info_get_n_fields(info);
    //gint n_methods = g_union_info_get_n_methods(info);

    void *boxed = self->GetAlignedPointerFromInternalField(0);

    for (int i = 0; i < n_fields; i++) {
        GIArgument   value;
        GIFieldInfo *field = g_union_info_get_field(info, i);
        GITypeInfo  *type  = g_field_info_get_type(field);
        const char  *fieldName = g_base_info_get_name(field);

        if (g_field_info_get_field(field, boxed, &value)) {

            self->Set( UTF8(fieldName),
                    GIArgumentToV8(isolate, type, &value));

            GITypeTag tag = g_type_info_get_tag(type);
            LOG("Type: %s", g_type_tag_to_string (tag) );

            if (g_str_equal(fieldName, "type")) {
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
            }
        }

        //FreeGIArgument(type, value);
        g_base_info_unref (field);
        g_base_info_unref (type);
        //g_free(fieldName);
    }

/* for (int i = 0; i < n_methods; i++) {
 *        GIFunctionInfo *func_info = g_union_info_get_method(info, i);
 *        GIFunctionInfoFlags flags = g_function_info_get_flags(func_info);
 *
 *        if ((flags & GI_FUNCTION_IS_METHOD) &&
 *            !(flags & GI_FUNCTION_IS_CONSTRUCTOR))
 *            self->Set( UTF8_NAME(func_info), MakeFunction(isolate, func_info));
 *
 *        g_base_info_unref (func_info);
 *    } */
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
        isolate->ThrowException (Exception::TypeError (String::NewFromUtf8 (isolate, "Not a construct call.")));
        return;
    }

    Local<Object> self = args.This ();

    if (args[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromBoxed is called. */

        /* XXX: We might want to copy the boxed? */
        void *boxed = External::Cast (*args[0])->Value ();

        self->SetAlignedPointerInInternalField (0, boxed);

        //GIStructInfo *struct_info;
        GIBaseInfo *base_info;
        GIInfoType  info_type;
        GType       gtype;
        const char *typeName;

        base_info = (GIBaseInfo *) External::Cast (*args.Data ())->Value ();
        info_type = g_base_info_get_type (base_info);
        gtype     = g_registered_type_info_get_g_type((GIRegisteredTypeInfo *) base_info);
        typeName  = g_registered_type_info_get_type_name((GIRegisteredTypeInfo *) base_info);
        //printf(g_registered_type_info_get_type_name(base_info));

        if (info_type == GI_INFO_TYPE_STRUCT) {
            InitBoxedFromStruct(isolate, self, base_info);
        } else if (info_type == GI_INFO_TYPE_INTERFACE) {
            InitBoxedFromStruct(isolate, self, base_info); // FIXME does it work?
        } else if (info_type == GI_INFO_TYPE_UNION) {
            InitBoxedFromUnion(isolate, self, base_info);
        } else {
            g_assert_not_reached();
        }

    } else {
        /* TODO: Boxed construction not supported yet. */
        g_assert_not_reached ();
    }
}

static Local<FunctionTemplate>
GetBoxedTemplate(Isolate *isolate, GIBaseInfo *info, GType type) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);
    void  *data = g_type_get_qdata (gtype, gnode_js_template_quark ());

    if (data) {
        Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) data;
        Local<FunctionTemplate> tpl = Local<FunctionTemplate>::New (isolate, *persistent);
        return tpl;
    } else {
        Local<FunctionTemplate> tpl = FunctionTemplate::New (isolate, BoxedConstructor, External::New (isolate, info));

        Persistent<FunctionTemplate> *persistent = new Persistent<FunctionTemplate>(isolate, tpl);
        persistent->SetWeak (g_base_info_ref (info), BoxedClassDestroyed);
        g_type_set_qdata (gtype, gnode_js_template_quark (), persistent);

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

static Local<Function> MakeBoxed(Isolate *isolate, GIBaseInfo *info) {
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
