/*
 * fundamental.cc
 *
 * See fundamental.h. Wraps fundamental (non-GObject) ref-counted types such as
 * GskRenderNode. The wrapper owns exactly one reference (taken via the type's
 * introspected ref function, or adopted from a transfer-full return) and drops
 * it on garbage collection via the unref function. Unlike GObject wrappers this
 * uses no toggle-ref / qdata / weak-ref machinery — a fundamental type is not a
 * GObject and those calls would fail their G_IS_OBJECT assertions (#468).
 */

#include <girepository.h>
#include <glib.h>

#include "fundamental.h"
#include "gi.h"
#include "macros.h"
#include "util.h"
#include "value.h"

using v8::External;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Object;
using Nan::New;
using Nan::Persistent;
using Nan::WeakCallbackType;

namespace GNodeJS {

/* Per-instance bookkeeping so the GC weak callback can drop our reference. */
struct FundamentalInstance {
    void *data;
    GIObjectInfoUnrefFunction unref;
    Persistent<Object> *persistent;
};

bool IsFundamentalObjectInfo (GIObjectInfo *info) {
    if (g_base_info_get_type (info) != GI_INFO_TYPE_OBJECT)
        return false;
    if (!g_object_info_get_fundamental (info))
        return false;

    /* GParamSpec is also a fundamental (non-GObject) type, but it has its own
     * dedicated wrapper (param_spec.cc) that predates this one and is used by
     * the value.cc / V8ToGIArgumentInterface param paths; keep it on that
     * path rather than diverting it here. */
    GType gtype = g_registered_type_info_get_g_type (info);
    if (g_type_is_a (gtype, G_TYPE_PARAM))
        return false;

    return true;
}

/*
 * The ref/unref functions are declared on the root fundamental type (e.g.
 * GskRenderNode) and are not repeated on derived infos (GskColorNode), so walk
 * up the parent chain until we find them.
 */
static void GetRefFunctions (GIObjectInfo *info,
                             GIObjectInfoRefFunction *refOut,
                             GIObjectInfoUnrefFunction *unrefOut) {
    *refOut = NULL;
    *unrefOut = NULL;

    GIObjectInfo *current = g_base_info_ref (info);
    while (current != NULL) {
        auto ref = g_object_info_get_ref_function_pointer (current);
        auto unref = g_object_info_get_unref_function_pointer (current);
        if (ref != NULL || unref != NULL) {
            *refOut = ref;
            *unrefOut = unref;
            break;
        }
        GIObjectInfo *parent = g_object_info_get_parent (current);
        g_base_info_unref (current);
        current = parent;
    }

    if (current != NULL)
        g_base_info_unref (current);
}

void RefFundamentalForTransferFullIn (GITypeInfo *type_info, GIArgument *arg) {
    if (arg->v_pointer == NULL)
        return;

    if (g_type_info_get_tag (type_info) != GI_TYPE_TAG_INTERFACE)
        return;

    GIBaseInfo *iface = g_type_info_get_interface (type_info);

    /* The callee takes ownership of one reference (transfer-full). The JS
     * wrapper keeps its own single reference and drops it on GC, so without an
     * extra reference here the object would be finalized out from under the
     * callee. This is the fundamental counterpart of RefObjectForTransferFullIn
     * (GObjects, #439) and CopyBoxedForTransferFullIn (boxed, #409). */
    if (IsFundamentalObjectInfo (iface)) {
        GIObjectInfoRefFunction ref;
        GIObjectInfoUnrefFunction unref;
        GetRefFunctions (iface, &ref, &unref);
        if (ref != NULL)
            ref (arg->v_pointer);
    }

    g_base_info_unref (iface);
}

static void FundamentalDestroyed (const Nan::WeakCallbackInfo<FundamentalInstance> &info) {
    FundamentalInstance *self = info.GetParameter ();

    if (self->data != NULL && self->unref != NULL)
        self->unref (self->data);

    /* Nan's kParameter weak callback already Reset()s the handle in its first
     * pass (nan_weak.h); calling Reset() again here would double-destroy the
     * global handle (V8 "IsInUse" fatal). Just free our bookkeeping, matching
     * BoxedDestroyed. */
    delete self->persistent;
    delete self;
}

static void FundamentalConstructor (const Nan::FunctionCallbackInfo<Value> &info) {
    if (!info.IsConstructCall ()) {
        Nan::ThrowTypeError ("Not a construct call");
        return;
    }

    Local<Object> self = info.This ();
    GIObjectInfo *gi_info = (GIObjectInfo *) External::Cast (*info.Data ())->Value ();
    GType gtype = g_registered_type_info_get_g_type (gi_info);

    if (!info[0]->IsExternal ()) {
        /* Fundamental types can't be created with g_object_new; they are
         * obtained from function returns or their static constructors
         * (e.g. `Gsk.ColorNode.new(...)`). */
        char *message = g_strdup_printf (
            "Cannot construct fundamental type %s directly; use its static constructor (e.g. .new())",
            g_type_name (gtype));
        Nan::ThrowError (message);
        g_free (message);
        return;
    }

    void *ptr = External::Cast (*info[0])->Value ();
    auto ownership = (ResourceOwnership) Nan::To<int32_t> (info[1]).ToChecked ();

    GIObjectInfoRefFunction ref;
    GIObjectInfoUnrefFunction unref;
    GetRefFunctions (gi_info, &ref, &unref);

    /* Own exactly one reference for the lifetime of the wrapper. A
     * transfer-full return (kTransfer) already handed us one; otherwise add our
     * own so the instance stays alive while JS holds the wrapper. */
    if (ownership != kTransfer && ref != NULL)
        ptr = ref (ptr);

    FundamentalInstance *instance = new FundamentalInstance ();
    instance->data = ptr;
    instance->unref = unref;
    instance->persistent = new Persistent<Object> (self);
    instance->persistent->SetWeak (instance, FundamentalDestroyed, WeakCallbackType::kParameter);

    self->SetAlignedPointerInInternalField (0, ptr);
    SET_OBJECT_GTYPE (self, gtype);
}

static void FundamentalToString (const Nan::FunctionCallbackInfo<Value> &info) {
    Local<Object> self = info.This ();

    if (!ValueHasInternalField (self)) {
        Nan::ThrowTypeError ("Object is not a fundamental type");
        return;
    }

    GType gtype = GET_OBJECT_GTYPE (self);
    void *address = self->GetAlignedPointerFromInternalField (0);
    char *str = g_strdup_printf ("[%s %#zx]", g_type_name (gtype), (size_t) address);
    info.GetReturnValue ().Set (UTF8 (str));
    g_free (str);
}

static Local<FunctionTemplate> GetFundamentalBaseTemplate () {
    static Persistent<FunctionTemplate> baseTemplate;

    if (baseTemplate.IsEmpty ()) {
        auto tpl = New<FunctionTemplate> ();
        tpl->SetClassName (UTF8 ("FundamentalBaseClass"));
        Nan::SetPrototypeMethod (tpl, "toString", FundamentalToString);
        baseTemplate.Reset (tpl);
    }

    return New (baseTemplate);
}

static void FundamentalClassDestroyed (const Nan::WeakCallbackInfo<GIBaseInfo> &info) {
    GIBaseInfo *gi_info = info.GetParameter ();
    GType gtype = g_registered_type_info_get_g_type (gi_info);

    auto *persistentTpl = (Persistent<FunctionTemplate> *) g_type_get_qdata (gtype, GNodeJS::template_quark ());
    auto *persistentFn  = (Persistent<Function> *)         g_type_get_qdata (gtype, GNodeJS::function_quark ());
    delete persistentTpl;
    delete persistentFn;

    g_type_set_qdata (gtype, GNodeJS::template_quark (), NULL);
    g_type_set_qdata (gtype, GNodeJS::function_quark (), NULL);

    g_base_info_unref (gi_info);
}

static Local<FunctionTemplate> GetFundamentalTemplate (GIObjectInfo *info, GType gtype) {
    void *data = g_type_get_qdata (gtype, GNodeJS::template_quark ());

    if (data) {
        auto *persistent = (Persistent<FunctionTemplate> *) data;
        return New<FunctionTemplate> (*persistent);
    }

    /* The External holds a borrowed pointer; the owned ref is taken by the
     * SetWeak below and released in FundamentalClassDestroyed. `info` stays
     * alive for the template's whole lifetime, so the borrow is safe (mirrors
     * boxed.cc's GetBoxedTemplate). */
    auto tpl = New<FunctionTemplate> (FundamentalConstructor, New<External> (info));
    tpl->SetClassName (UTF8 (g_type_name (gtype)));
    tpl->InstanceTemplate ()->SetInternalFieldCount (1);
    Nan::SetPrototypeTemplate (
        tpl, "__gtype__", v8::BigInt::NewFromUnsigned (Isolate::GetCurrent (), gtype));

    GType parent_type = g_type_parent (gtype);
    if (parent_type == G_TYPE_INVALID) {
        tpl->Inherit (GetFundamentalBaseTemplate ());
    } else {
        GIObjectInfo *parent_info = (GIObjectInfo *) g_irepository_find_by_gtype (NULL, parent_type);
        if (parent_info != NULL) {
            tpl->Inherit (GetFundamentalTemplate (parent_info, parent_type));
            g_base_info_unref (parent_info);
        } else {
            tpl->Inherit (GetFundamentalBaseTemplate ());
        }
    }

    auto *persistentTpl = new Persistent<FunctionTemplate> (tpl);
    auto *persistentFn  = new Persistent<Function> (Nan::GetFunction (tpl).ToLocalChecked ());
    persistentTpl->SetWeak (
        g_base_info_ref (info), FundamentalClassDestroyed, WeakCallbackType::kParameter);

    g_type_set_qdata (gtype, GNodeJS::template_quark (), persistentTpl);
    g_type_set_qdata (gtype, GNodeJS::function_quark (), persistentFn);

    return tpl;
}

MaybeLocal<Function> MakeFundamentalClass (GIObjectInfo *info) {
    GType gtype = g_registered_type_info_get_g_type (info);

    if (gtype == G_TYPE_NONE || gtype == G_TYPE_INVALID)
        return MaybeLocal<Function> ();

    void *data = g_type_get_qdata (gtype, GNodeJS::function_quark ());
    if (data == NULL) {
        GetFundamentalTemplate (info, gtype);
        data = g_type_get_qdata (gtype, GNodeJS::function_quark ());
    }

    auto *persistent = (Persistent<Function> *) data;
    return New<Function> (*persistent);
}

Local<Value> WrapperFromFundamental (GIObjectInfo *info, void *ptr, ResourceOwnership ownership) {
    if (ptr == NULL)
        return Nan::Null ();

    /* Resolve the *actual* runtime type of the instance (e.g. GskColorNode)
     * rather than the static return type (GskRenderNode), mirroring how
     * WrapperFromGObject uses G_OBJECT_TYPE. Introspected fundamental types are
     * classed GTypeInstances, so G_TYPE_FROM_INSTANCE is valid here. */
    GIObjectInfo *resolved = NULL;
    GType instance_gtype = G_TYPE_FROM_INSTANCE (ptr);
    if (instance_gtype != G_TYPE_INVALID) {
        GIBaseInfo *found = g_irepository_find_by_gtype (NULL, instance_gtype);
        if (found != NULL) {
            if (IsFundamentalObjectInfo (found))
                resolved = found;
            else
                g_base_info_unref (found);
        }
    }

    auto maybeConstructor = MakeFundamentalClass (resolved != NULL ? resolved : info);

    if (resolved != NULL)
        g_base_info_unref (resolved);

    if (maybeConstructor.IsEmpty ())
        return Nan::Null ();

    Local<Value> args[] = {
        New<External> (ptr),
        New<v8::Int32> ((int32_t) ownership),
    };

    auto instance = Nan::NewInstance (maybeConstructor.ToLocalChecked (), 2, args);
    if (instance.IsEmpty ())
        return Nan::Null ();

    return instance.ToLocalChecked ();
}


/*
 * GVariant
 *
 * GVariant is a fundamental ref-counted type, but GI classes it as a
 * GIStructInfo (g_type == G_TYPE_VARIANT), so the object-info machinery above
 * (G_TYPE_FROM_INSTANCE, introspected ref/unref functions) does not apply. It
 * uses the shared FundamentalInstance lifetime with hardcoded g_variant_ref/
 * unref and floating-reference handling (g_variant_ref_sink / take_ref).
 */

/* Matches GIObjectInfoUnrefFunction's signature so FundamentalInstance can call
 * it uniformly; avoids a function-pointer cast. */
static void VariantUnref (void *data) {
    g_variant_unref ((GVariant *) data);
}

bool IsVariantInfo (GIBaseInfo *info) {
    GIInfoType type = g_base_info_get_type (info);
    if (type != GI_INFO_TYPE_STRUCT
            && type != GI_INFO_TYPE_BOXED
            && type != GI_INFO_TYPE_UNION
            && type != GI_INFO_TYPE_OBJECT)
        return false;
    return g_registered_type_info_get_g_type (info) == G_TYPE_VARIANT;
}

bool IsVariantTypeInfo (GITypeInfo *type_info) {
    if (g_type_info_get_tag (type_info) != GI_TYPE_TAG_INTERFACE)
        return false;
    GIBaseInfo *iface = g_type_info_get_interface (type_info);
    bool result = IsVariantInfo (iface);
    g_base_info_unref (iface);
    return result;
}

static void VariantConstructor (const Nan::FunctionCallbackInfo<Value> &info) {
    if (!info.IsConstructCall ()) {
        Nan::ThrowTypeError ("Not a construct call");
        return;
    }

    Local<Object> self = info.This ();

    if (!info[0]->IsExternal ()) {
        /* Like the object fundamentals, variants are obtained from function
         * returns or their static constructors (e.g. GLib.Variant.newString),
         * not built with `new`. */
        Nan::ThrowError (
            "Cannot construct GLib.Variant directly; use a static constructor (e.g. GLib.Variant.newString())");
        return;
    }

    void *ptr = External::Cast (*info[0])->Value ();
    auto ownership = (ResourceOwnership) Nan::To<int32_t> (info[1]).ToChecked ();

    /* Own exactly one full (non-floating) reference for the wrapper's lifetime.
     * A transfer-full return already handed us a reference to adopt (take_ref
     * sinks it if it was floating); otherwise add our own (ref_sink sinks a
     * fresh floating variant, or refs a shared one). */
    if (ownership == kTransfer)
        ptr = g_variant_take_ref ((GVariant *) ptr);
    else
        ptr = g_variant_ref_sink ((GVariant *) ptr);

    FundamentalInstance *instance = new FundamentalInstance ();
    instance->data = ptr;
    instance->unref = VariantUnref;
    instance->persistent = new Persistent<Object> (self);
    instance->persistent->SetWeak (instance, FundamentalDestroyed, WeakCallbackType::kParameter);

    self->SetAlignedPointerInInternalField (0, ptr);
    SET_OBJECT_GTYPE (self, G_TYPE_VARIANT);
}

static Local<FunctionTemplate> GetVariantTemplate () {
    GType gtype = G_TYPE_VARIANT;
    void *data = g_type_get_qdata (gtype, GNodeJS::template_quark ());

    if (data) {
        auto *persistent = (Persistent<FunctionTemplate> *) data;
        return New<FunctionTemplate> (*persistent);
    }

    auto tpl = New<FunctionTemplate> (VariantConstructor);
    tpl->SetClassName (UTF8 (g_type_name (gtype)));
    tpl->InstanceTemplate ()->SetInternalFieldCount (1);
    Nan::SetPrototypeTemplate (
        tpl, "__gtype__", v8::BigInt::NewFromUnsigned (Isolate::GetCurrent (), gtype));
    tpl->Inherit (GetFundamentalBaseTemplate ());

    /* G_TYPE_VARIANT is a static built-in fundamental that never unloads, so
     * (unlike the per-namespace fundamental object templates) there is no
     * class-destroyed weak callback to tear the cache down. */
    auto *persistentTpl = new Persistent<FunctionTemplate> (tpl);
    auto *persistentFn  = new Persistent<Function> (Nan::GetFunction (tpl).ToLocalChecked ());
    g_type_set_qdata (gtype, GNodeJS::template_quark (), persistentTpl);
    g_type_set_qdata (gtype, GNodeJS::function_quark (), persistentFn);

    return tpl;
}

Local<Function> MakeVariantClass (GIBaseInfo *info) {
    void *data = g_type_get_qdata (G_TYPE_VARIANT, GNodeJS::function_quark ());
    if (data == NULL) {
        GetVariantTemplate ();
        data = g_type_get_qdata (G_TYPE_VARIANT, GNodeJS::function_quark ());
    }

    auto *persistent = (Persistent<Function> *) data;
    return New<Function> (*persistent);
}

Local<Value> WrapperFromVariant (void *ptr, ResourceOwnership ownership) {
    if (ptr == NULL)
        return Nan::Null ();

    Local<Function> constructor = MakeVariantClass (NULL);

    Local<Value> args[] = {
        New<External> (ptr),
        New<v8::Int32> ((int32_t) ownership),
    };

    auto instance = Nan::NewInstance (constructor, 2, args);
    if (instance.IsEmpty ())
        return Nan::Null ();

    return instance.ToLocalChecked ();
}

void RefVariantForTransferFullIn (GITypeInfo *type_info, GIArgument *arg) {
    if (arg->v_pointer == NULL)
        return;

    /* The callee takes ownership of one reference; keep our own so the JS
     * wrapper isn't unref'd out from under it (counterpart of the boxed/object
     * transfer-full helpers). */
    if (IsVariantTypeInfo (type_info))
        arg->v_pointer = g_variant_ref ((GVariant *) arg->v_pointer);
}

};
