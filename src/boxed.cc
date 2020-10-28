
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
#include "modules/cairo/cairo.h"

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
        WARN("received bad type: %s", g_info_type_to_string (type));
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

static void InitBoxedFromObject(Local<Object> wrapper, Local<Value> object) {
    if (!object->IsObject ())
        return;

    Local<Object> property_hash = TO_OBJECT (object);
    Local<Array> keys = Nan::GetOwnPropertyNames (property_hash).ToLocalChecked();
    int n_keys = keys->Length ();

    for (int i = 0; i < n_keys; i++) {
        Local<String> key = TO_STRING (Nan::Get(keys, i).ToLocalChecked());
        Local<Value> value = Nan::Get(property_hash, key).ToLocalChecked();

        Nan::Set(wrapper, key, value);
    }

    return;
}

static void BoxedDestroyed(const Nan::WeakCallbackInfo<Boxed> &info);

static void BoxedConstructor(const Nan::FunctionCallbackInfo<Value> &info) {
    /* See gobject.cc for how this works */
    if (!info.IsConstructCall ()) {
        Nan::ThrowTypeError("Not a construct call");
        return;
    }

    GIFunctionInfo* constructorInfo = NULL;

    void *boxed = NULL;
    unsigned long size = 0;
    bool owns_memory = true;

    Local<Object> self = info.This ();
    GIBaseInfo *gi_info = (GIBaseInfo *) External::Cast (*info.Data ())->Value ();
    GType gtype = g_registered_type_info_get_g_type (gi_info);

    if (info[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromBoxed is called. */
        bool mustCopy = Nan::To<bool> (info[1]).ToChecked();

        boxed = External::Cast(*info[0])->Value();

        if (mustCopy) {
            if (gtype != G_TYPE_NONE) {
                boxed = g_boxed_copy (gtype, boxed);
            }
            else if ((size = Boxed::GetSize(gi_info)) != 0) {
                void *boxedCopy = malloc(size);
                memcpy(boxedCopy, boxed, size);
                boxed = boxedCopy;
            }
        }
        else {
            owns_memory = false;
        }
    } else {
        /* User code calling `new Pango.AttrList()` */

        GIFunctionInfo* constructorInfo = FindBoxedConstructor(gi_info, gtype);

        if (constructorInfo != NULL) {

            FunctionInfo func(constructorInfo);
            GIArgument return_value;
            GError *error = NULL;

            auto jsResult = FunctionCall (&func, info, &return_value, &error);

            g_base_info_unref (constructorInfo);

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

    Boxed *box = new Boxed();
    box->data = boxed;
    box->size = size;
    box->owns_memory = owns_memory;
    box->gtype = gtype;
    box->info = g_base_info_ref (gi_info);
    box->persistent = new Nan::Persistent<Object>(self);
    box->persistent->SetWeak(box, BoxedDestroyed, Nan::WeakCallbackType::kParameter);

    self->SetAlignedPointerInInternalField (0, boxed);
    self->SetAlignedPointerInInternalField (1, box);

    SET_OBJECT_GTYPE (self, gtype);

    if (constructorInfo == NULL || g_callable_info_get_n_args(constructorInfo) == 0)
        InitBoxedFromObject(self, info[0]);
}

static void BoxedDestroyed(const Nan::WeakCallbackInfo<Boxed> &info) {
    Boxed *box = info.GetParameter();

    /*
     * box->owns_memory is false usually for objects in GIRepository,
     * such as Typelib and BaseInfo.
     */
    if (box->owns_memory) {
        if (G_TYPE_IS_BOXED(box->gtype)) {
            g_boxed_free(box->gtype, box->data);
        }
        else if (box->size != 0) {
            // Allocated in ./function.cc @ AllocateArgument
            free(box->data);
        }
        else if (box->data != NULL) {
            /*
             * TODO(find informations on what to do here. Only seems to be reached for GI.Typelib)
             */
            if (strcmp(g_base_info_get_name (box->info), "Typelib") != 0)
                WARN("boxed possibly not freed (%s.%s : %s)",
                        g_base_info_get_namespace (box->info),
                        g_base_info_get_name (box->info),
                        g_type_name (box->gtype));
        }
    }

    g_base_info_unref (box->info);
    delete box->persistent;
    delete box;
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

    Local<FunctionTemplate> tpl;
    MaybeLocal<FunctionTemplate> cairoTpl = Cairo::GetTemplate (info);

    if (!cairoTpl.IsEmpty()) {
        tpl = cairoTpl.ToLocalChecked();
    }
    else {
        tpl = New<FunctionTemplate>(BoxedConstructor, New<External>(info));
        tpl->InstanceTemplate()->SetInternalFieldCount(2);

        if (gtype != G_TYPE_NONE) {
            tpl->SetClassName (UTF8 (g_type_name (gtype)));
        } else {
            tpl->SetClassName (UTF8 (g_base_info_get_name (info)));
        }
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
        auto fn = Nan::New<Function> (*persistent);
        return fn;
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

Local<Value> WrapperFromBoxed(GIBaseInfo *info, void *data, bool mustCopy) {
    if (data == NULL)
        return Nan::Null();

    Local<Function> constructor = MakeBoxedClass (info);

    Local<Value> boxed_external = Nan::New<External> (data);
    Local<Value> must_copy_value = Nan::New<v8::Boolean> (mustCopy);
    Local<Value> args[] = { boxed_external, must_copy_value };

    MaybeLocal<Object> instance = Nan::NewInstance(constructor, 2, args);

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
