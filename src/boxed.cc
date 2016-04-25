
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
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
//using v8::Persistent;
using Nan::New;
using Nan::Persistent;

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
}

static void InitBoxedFromUnion (Isolate *isolate, Local<Object> self, GIUnionInfo *info) {
    void *boxed = self->GetAlignedPointerFromInternalField(0);

    // XXX is there a standard way to get the type?
    gint n_fields = g_union_info_get_n_fields(info);
    for (int i = 0; i < n_fields; i++) {
        GIArgument   value;
        GIFieldInfo *field = g_union_info_get_field(info, i);
        //print_info(field);

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
        Nan::ThrowTypeError("Not a construct call");
        return;
    }

    Local<Object> self = args.This ();

    if (args[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromBoxed is called. */

        /* XXX: We might want to copy the boxed? */
        void *boxed = External::Cast (*args[0])->Value ();
        self->SetAlignedPointerInInternalField (0, boxed);

        GIBaseInfo *base_info = (GIBaseInfo *) External::Cast (*args.Data ())->Value ();
        g_assert(base_info != nullptr);

        GIInfoType info_type = g_base_info_get_type (base_info);

        if (GI_IS_REGISTERED_TYPE_INFO(base_info))
            self->Set(UTF8("$gtype"), Nan::New<Number>(g_registered_type_info_get_g_type(base_info)));

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

//static void InstallFunction (Isolate *isolate, Local<FunctionTemplate> tpl, GIFunctionInfo *func_info) {
    //GIFunctionInfoFlags flags = g_function_info_get_flags(func_info);
    //const char *func_name = g_base_info_get_name(func_info);
    //char *camel_name = Util::toCamelCase(func_name);

    //Local<Function> fn = MakeFunction(isolate, func_info);

    //if ((flags & GI_FUNCTION_IS_METHOD) &&
            //!(flags & GI_FUNCTION_IS_CONSTRUCTOR)) {
        //tpl->PrototypeTemplate()->Set(UTF8(func_name), fn);
        //tpl->PrototypeTemplate()->Set(UTF8(camel_name), fn);

    //} else {
        //tpl->Set(UTF8(func_name), fn);
        //tpl->Set(UTF8(camel_name), fn);
    //}
    //if ((flags & GI_FUNCTION_IS_GETTER) || (flags & GI_FUNCTION_IS_SETTER)) {
        //print_info(func_info);
    //}

    //g_free(camel_name);
//}

static Local<FunctionTemplate> GetBoxedTemplate(Isolate *isolate, GIBaseInfo *info, GType gtype) {
    void  *data = g_type_get_qdata (gtype, gnode_js_template_quark ());

    if (data) {
        Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) data;
        Local<FunctionTemplate> tpl = Local<FunctionTemplate>::New (isolate, *persistent);
        return tpl;
    } else {
        Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate,
            BoxedConstructor, External::New (isolate, info));

        // g_type_name(gtype) ? FIXME
        //const char *class_name = g_base_info_get_name (info);
        const char *class_name = g_type_name(gtype);
        tpl->SetClassName( UTF8(class_name) );
        tpl->InstanceTemplate()->SetInternalFieldCount(1);
        tpl->Set(UTF8("$gtype"), Nan::New<Number>(gtype));
        if (G_TYPE_IS_INTERFACE(gtype)) {
            WARN("GetBoxedTemplate: GTypeInterface: %s", g_type_name(gtype));
        }

        DEBUG("GetBoxedTemplate: %s", class_name);
        print_gtype(gtype);
        printf("\n");

        // FIXME handle getter/setters
        // FIXME re-use code
        //
        if (GI_IS_STRUCT_INFO(info)) {
            int n_methods = g_struct_info_get_n_methods(info);
            for (int i = 0; i < n_methods; i++) {
                GIFunctionInfo *func_info = g_struct_info_get_method(info, i);
                InstallFunction(isolate, tpl, func_info);
                g_base_info_unref(func_info);
            }
        } else if (GI_IS_UNION_INFO(info)) {
            gint n_methods = g_union_info_get_n_methods(info);
            for (int i = 0; i < n_methods; i++) {
                GIFunctionInfo *func_info = g_union_info_get_method(info, i);
                InstallFunction(isolate, tpl, func_info);
                g_base_info_unref (func_info);
            }
        } else {
            print_info(info);
            g_assert_not_reached();
        }

        Persistent<FunctionTemplate> *persistent = new Persistent<FunctionTemplate>(isolate, tpl);
        persistent->SetWeak( g_base_info_ref(info), BoxedClassDestroyed);
        g_type_set_qdata(gtype, gnode_js_template_quark (), persistent);

        GType parent_type = g_type_parent(gtype);
        if (parent_type != 0) {
            //DEBUG("Boxed parent: %zu", parent_type);
            GIBaseInfo *parent_info = g_irepository_find_by_gtype(NULL, parent_type);
            if (parent_info != NULL) {
                Handle<FunctionTemplate> parent_tpl = GetBoxedTemplate(isolate, parent_info, parent_type);
                tpl->Inherit(parent_tpl);
            }
        //} else {
            //DEBUG("Boxed no parent: %zu", gtype);
        }

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
