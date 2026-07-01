/*
 * fundamental.h
 *
 * Wrapping of GLib *fundamental* ref-counted types that are not GObjects —
 * e.g. GskRenderNode, which has its own gsk_render_node_ref()/unref() instead
 * of the GObject machinery. GObject-Introspection reports these as
 * GI_INFO_TYPE_OBJECT (a GIObjectInfo) with g_object_info_get_fundamental()
 * == TRUE, but running the GObject wrapper path over them fires G_IS_OBJECT
 * assertions (#468). They get their own thin wrapper here.
 */

#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

#include "value.h"

using v8::Function;
using v8::Local;
using v8::MaybeLocal;
using v8::Value;

namespace GNodeJS {

/* True when the GIObjectInfo describes a fundamental (non-GObject) type. */
bool IsFundamentalObjectInfo (GIObjectInfo *info);

/* Build (or fetch the cached) constructor for a fundamental type. Mirrors
 * MakeClass()/MakeBoxedClass(); JS attaches the introspected methods to it. */
MaybeLocal<Function> MakeFundamentalClass (GIObjectInfo *info);

/* Wrap a fundamental instance for return to JS, taking a reference according
 * to `ownership` (kTransfer: adopt the incoming ref; otherwise add our own). */
Local<Value> WrapperFromFundamental (GIObjectInfo *info, void *ptr, ResourceOwnership ownership);

/* Add the reference a transfer-full IN argument's callee will own, so the
 * instance isn't finalized out from under it when the JS wrapper is GC'd.
 * Fundamental counterpart of RefObjectForTransferFullIn / CopyBoxedForTransferFullIn. */
void RefFundamentalForTransferFullIn (GITypeInfo *type_info, GIArgument *arg);


/*
 * GVariant is also a fundamental (non-GObject) ref-counted type, but GObject-
 * Introspection reports it as a GI_INFO_TYPE_STRUCT (a GIStructInfo) with
 * g_type == G_TYPE_VARIANT, not as a fundamental GIObjectInfo. It is refcounted
 * with g_variant_ref/unref (and has floating references), so it gets the same
 * single-owned-reference wrapper as the object fundamentals above rather than
 * the boxed copy/free path. Its JS class is still built from the struct info
 * (so its introspected methods attach), just with this ref/unref lifetime.
 */

/* True when `info` is a registered type whose g_type is G_TYPE_VARIANT. */
bool IsVariantInfo (GIBaseInfo *info);

/* True when `type_info` is an interface referring to G_TYPE_VARIANT. */
bool IsVariantTypeInfo (GITypeInfo *type_info);

/* Build (or fetch the cached) constructor for GLib.Variant. */
Local<Function> MakeVariantClass (GIBaseInfo *info);

/* Wrap a GVariant for return to JS, taking a reference according to `ownership`
 * (kTransfer: adopt the incoming reference; otherwise add our own). */
Local<Value> WrapperFromVariant (void *ptr, ResourceOwnership ownership);

/* Transfer-full IN counterpart for GVariant (adds the callee's reference). */
void RefVariantForTransferFullIn (GITypeInfo *type_info, GIArgument *arg);

};
