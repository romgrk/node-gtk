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

};
