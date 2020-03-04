
#include <girepository.h>
#include <glib.h>

#include "boxed.h"
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
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Persistent;
using Nan::New;
using Nan::WeakCallbackType;

namespace GNodeJS {




size_t Boxed::GetSize (GIBaseInfo *boxed_info) {
    GIInfoType type = g_base_info_get_type(boxed_info);
    if (type == GI_INFO_TYPE_STRUCT) {
        return g_struct_info_get_size((GIStructInfo*)boxed_info);
    } else if (type == GI_INFO_TYPE_UNION) {
        return g_union_info_get_size((GIUnionInfo*)boxed_info);
    } else {
        warn("received bad type: %s", g_info_type_to_string (type));
        g_assert_not_reached();
    }
}

static bool IsNoArgsConstructor (GIFunctionInfo *info) {
    auto flags = g_function_info_get_flags (info);
    return ((flags & GI_FUNCTION_IS_CONSTRUCTOR) != 0
        && g_callable_info_get_n_args (info) == 0);
}

static bool IsConstructor (GIFunctionInfo *info) {
    auto flags = g_function_info_get_flags (info);
    return (flags & GI_FUNCTION_IS_CONSTRUCTOR) != 0;
}

static GIFunctionInfo* FindBoxedConstructorCached (GType gtype) {
    if (gtype == G_TYPE_NONE)
        return NULL;

    GIFunctionInfo* fn_info = (GIFunctionInfo*) g_type_get_qdata(gtype, GNodeJS::constructor_quark());

    if (fn_info != NULL)
        return fn_info;

    return NULL;
}

static GIFunctionInfo* FindBoxedConstructor (GIBaseInfo* info, GType gtype) {
    GIFunctionInfo* fn_info = NULL;

    if ((fn_info = FindBoxedConstructorCached(gtype)) != NULL)
        return g_base_info_ref (fn_info);

    if (GI_IS_STRUCT_INFO (info)) {
        int n_methods = g_struct_info_get_n_methods (info);
        for (int i = 0; i < n_methods; i++) {
            fn_info = g_struct_info_get_method (info, i);

            if (IsNoArgsConstructor (fn_info))
                break;

            g_base_info_unref(fn_info);
            fn_info = NULL;
        }

        if (fn_info == NULL)
            fn_info = g_struct_info_find_method(info, "new");

        if (fn_info == NULL) {
            for (int i = 0; i < n_methods; i++) {
                fn_info = g_struct_info_get_method (info, i);

                if (IsConstructor (fn_info))
                    break;

                g_base_info_unref(fn_info);
                fn_info = NULL;
            }
        }
    }
    else {
        int n_methods = g_union_info_get_n_methods (info);
        for (int i = 0; i < n_methods; i++) {
            fn_info = g_union_info_get_method (info, i);

            if (IsNoArgsConstructor (fn_info))
                break;

            g_base_info_unref(fn_info);
            fn_info = NULL;
        }

        if (fn_info == NULL)
            fn_info = g_union_info_find_method(info, "new");

        if (fn_info == NULL) {
            for (int i = 0; i < n_methods; i++) {
                fn_info = g_union_info_get_method (info, i);

                if (IsConstructor (fn_info))
                    break;

                g_base_info_unref(fn_info);
                fn_info = NULL;
            }
        }
    }

    if (fn_info != NULL && gtype != G_TYPE_NONE) {
        g_type_set_qdata(gtype, GNodeJS::constructor_quark(),
                g_base_info_ref (fn_info));
    }

    return fn_info;
}

static void BoxedDestroyed(const Nan::WeakCallbackInfo<Boxed> &info);

static void BoxedConstructor(const Nan::FunctionCallbackInfo<Value> &info) {
    /* See gobject.cc for how this works */
    if (!info.IsConstructCall ()) {
        Nan::ThrowTypeError("Not a construct call");
        return;
    }

    void *boxed = NULL;
    unsigned long size = 0;

    Local<Object> self = info.This ();
    GIBaseInfo *gi_info = (GIBaseInfo *) External::Cast (*info.Data ())->Value ();
    GType gtype = g_registered_type_info_get_g_type (gi_info);

    if (info[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromBoxed is called. */

        boxed = External::Cast(*info[0])->Value();

    } else {
        /* User code calling `new Pango.AttrList()` */

        GIFunctionInfo* fn_info = FindBoxedConstructor(gi_info, gtype);

        if (fn_info != NULL) {

            FunctionInfo func(fn_info);
            GIArgument return_value;
            GError *error = NULL;

            auto jsResult = FunctionCall (&func, info, &return_value, &error);

            g_base_info_unref (fn_info);

            if (jsResult.IsEmpty()) {
                // func->Init() or func->TypeCheck() have thrown
                return;
            }

            if (error) {
                Throw::GError ("Boxed constructor failed", error);
                g_error_free (error);
                return;
            }

            boxed = return_value.v_pointer;

        } else if ((size = Boxed::GetSize(gi_info)) != 0) {
            boxed = calloc(1, size);

        } else {
            Nan::ThrowError("Boxed allocation failed: no constructor found");
            return;
        }

        if (!boxed) {
            Nan::ThrowError("Boxed allocation failed");
            return;
        }
    }

    Boxed *box = NULL;

    box = (Boxed *) g_tree_lookup(boxedMap, boxed);
    if (box != NULL) {
        RETURN (Nan::New(box->persistent));
        return;
    }

    self->SetAlignedPointerInInternalField (0, boxed);

    Nan::DefineOwnProperty(self,
            UTF8("__gtype__"),
            Nan::New<Number>(gtype),
            (v8::PropertyAttribute)(v8::PropertyAttribute::ReadOnly | v8::PropertyAttribute::DontEnum)
    );

    box = new Boxed();
    box->data = boxed;
    box->size = size;
    box->gtype = gtype;
    box->info = g_base_info_ref (gi_info);
    box->persistent = new Nan::Persistent<Object>(self);
    box->persistent->SetWeak(box, BoxedDestroyed, Nan::WeakCallbackType::kParameter);

    g_tree_insert(boxedMap, boxed, box);
}

static void BoxedDestroyed(const Nan::WeakCallbackInfo<Boxed> &info) {
    Boxed *box = info.GetParameter();
    void *data = box->data;

    if (G_TYPE_IS_BOXED(box->gtype)) {
        g_boxed_free(box->gtype, data);
    }
    else if (box->size != 0) {
        // Allocated in ./function.cc @ AllocateArgument
        free(data);
    }
    else if (data != NULL) {
        /*
         * TODO(find informations on what to do here. Only seems to be reached for GI.Typelib)
         */
        warn("boxed possibly not freed (%s.%s : %s)",
                g_base_info_get_namespace (box->info),
                g_base_info_get_name (box->info),
                g_type_name (box->gtype));
    }

    g_base_info_unref (box->info);
    delete box->persistent;
    delete box;

    g_tree_remove(boxedMap, data);
}

static void BoxedClassDestroyed(const v8::WeakCallbackInfo<GIBaseInfo> &info) {
    GIBaseInfo *gi_info = info.GetParameter ();
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) gi_info);

    auto *persistent_template = (Persistent<FunctionTemplate> *) g_type_get_qdata (gtype, GNodeJS::template_quark());
    auto *persistent_function = (Persistent<FunctionTemplate> *) g_type_get_qdata (gtype, GNodeJS::function_quark());
    delete persistent_template;
    delete persistent_function;

    auto fn_info = (GIFunctionInfo *) g_type_get_qdata (gtype, GNodeJS::constructor_quark());
    if (fn_info != NULL)
        g_base_info_unref (fn_info);

    g_type_set_qdata (gtype, GNodeJS::template_quark(), NULL);
    g_type_set_qdata (gtype, GNodeJS::function_quark(), NULL);
    g_type_set_qdata (gtype, GNodeJS::constructor_quark(), NULL);

    g_base_info_unref (gi_info);
}

/**
 * Get the constructor FunctionTemplate for the given type, cached.
 * @param info GIBaseInfo of the type
 * @param gtype GType of the type
 * @retuns the constructor FunctionTemplate
 */
Local<FunctionTemplate> GetBoxedTemplate(GIBaseInfo *info, GType gtype) {
    void *data = NULL;

    if (gtype != G_TYPE_NONE) {
        data = g_type_get_qdata(gtype, GNodeJS::template_quark());
    }

    /*
     * Template already created
     */

    if (data) {
        auto *persistent = (Persistent<FunctionTemplate> *) data;
        auto tpl = Nan::New<FunctionTemplate> (*persistent);
        return tpl;
    }

    /*
     * Template not created yet
     */

    auto tpl = New<FunctionTemplate>(BoxedConstructor, New<External>(info));
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    if (gtype != G_TYPE_NONE) {
        const char *class_name = g_type_name(gtype);
        tpl->SetClassName (UTF8(class_name));
    } else {
        const char *class_name = g_base_info_get_name (info);
        tpl->SetClassName (UTF8(class_name));
    }

    if (gtype == G_TYPE_NONE)
        return tpl;

    auto *persistent = new Persistent<FunctionTemplate>(Isolate::GetCurrent(), tpl);
    persistent->SetWeak(
            g_base_info_ref(info),
            BoxedClassDestroyed,
            WeakCallbackType::kParameter);

    g_type_set_qdata(gtype, GNodeJS::template_quark(), persistent);

    return tpl;
}

/**
 * Get the constructor function for the given type, cached.
 * Added because FunctionTemplate->GetFunction() seems to return a
 * different instance on each call.
 * @param info GIBaseInfo of the type
 * @param gtype GType of the type
 * @retuns the constructor function
 */
Local<Function> GetBoxedFunction(GIBaseInfo *info, GType gtype) {
    void *data = NULL;

    if (gtype != G_TYPE_NONE) {
        data = g_type_get_qdata(gtype, GNodeJS::function_quark());
    }

    if (data) {
        auto *persistent = (Persistent<Function> *) data;
        auto tpl = Nan::New<Function> (*persistent);
        return tpl;
    }

    Local<FunctionTemplate> tpl = GetBoxedTemplate (info, gtype);
    Local<Function> fn = Nan::GetFunction (tpl).ToLocalChecked();

    if (gtype == G_TYPE_NONE)
        return fn;

    auto *persistent = new Persistent<Function>(Isolate::GetCurrent(), fn);

    g_type_set_qdata(gtype, GNodeJS::function_quark(), persistent);

    return fn;
}

Local<Function> MakeBoxedClass(GIBaseInfo *info) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);

    if (gtype == G_TYPE_NONE) {
        auto moduleCache = GNodeJS::GetModuleCache();
        auto ns   = UTF8 (g_base_info_get_namespace (info));
        auto name = UTF8 (g_base_info_get_name (info));

        if (Nan::HasOwnProperty(moduleCache, ns).FromMaybe(false)) {
            auto module = TO_OBJECT (Nan::Get(moduleCache, ns).ToLocalChecked());

            if (Nan::HasOwnProperty(module, name).FromMaybe(false)) {
                auto constructor = TO_OBJECT (Nan::Get(module, name).ToLocalChecked());
                return Local<Function>::Cast (constructor);
            }
        }
    }

    return GetBoxedFunction (info, gtype);
}

Local<Value> WrapperFromBoxed(GIBaseInfo *info, void *data) {
    if (data == NULL)
        return Nan::Null();

    Local<Function> constructor = MakeBoxedClass (info);

    Local<Value> boxed_external = Nan::New<External> (data);
    Local<Value> args[] = { boxed_external };

    MaybeLocal<Object> instance = Nan::NewInstance(constructor, 1, args);

    // FIXME(we should propage failure here)
    if (instance.IsEmpty())
        return Nan::Null();

    return instance.ToLocalChecked();
}

void* PointerFromWrapper(Local<Value> value) {
    Local<Object> object = TO_OBJECT (value);
    g_assert(object->InternalFieldCount() > 0);
    void *boxed = object->GetAlignedPointerFromInternalField(0);
    return boxed;
}

};
