
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib.h>

using v8::Value;
using v8::Local;

namespace GNodeJS {

enum ResourceOwnership {
    kNone,
    kCopy,
    kTransfer
};

Local<Value> GListToV8  (GITypeInfo *info, GList  *glist);
Local<Value> GSListToV8 (GITypeInfo *info, GSList *glist);
Local<Value> GHashToV8 (GITypeInfo *info, GHashTable *hash);
Local<Value> ArrayToV8  (GITypeInfo *info, gpointer data, long length = -1);
Local<Value> GErrorToV8 (GITypeInfo *type_info, GError *err, ResourceOwnership ownership = kNone);
Local<Value> GIArgumentToV8 (GITypeInfo *type_info, GIArgument *argument, long length = -1, ResourceOwnership ownership = kNone);
long         GIArgumentToLength(GITypeInfo *type_info, GIArgument *arg, bool is_pointer);

bool         V8ToGIArgumentInterface (GIBaseInfo *gi_info, GIArgument *argument, Local<Value> value);
bool         V8ToGIArgument (GITypeInfo *type_info, GIArgument *argument, Local<Value> value, bool may_be_null);
bool         V8ToOutGIArgument(GITypeInfo *type_info, GIArgument *arg, Local<Value> value, bool may_be_null);
void         FreeGIArgument (GITypeInfo *type_info, GIArgument *argument, GITransfer transfer = GI_TRANSFER_EVERYTHING, GIDirection direction = GI_DIRECTION_OUT);
void         FreeGIArgumentArray (GITypeInfo *type_info, GIArgument *arg, GITransfer transfer = GI_TRANSFER_EVERYTHING, GIDirection direction = GI_DIRECTION_OUT, long length = -1);

// For a transfer-container IN GList/GSList/GHashTable, the callee frees the
// container structure itself, so node-gtk cannot walk it afterwards to free
// the (caller-owned) elements. These capture the element pointers *before*
// the call so they can be freed *after* it. See #399.
bool         IsTransferContainerInList (GITypeInfo *type_info, GITransfer transfer, GIDirection direction);
gpointer     CaptureTransferContainerElements (GITypeInfo *type_info, gpointer container);
void         FreeTransferContainerElements (GITypeInfo *type_info, gpointer captured);

// For a transfer-full IN boxed argument (or a C array of boxed pointers) the
// callee frees the passed memory, but the JS wrapper still owns its own copy,
// which would then be double-freed when the wrapper is finalized. Replace each
// such pointer with a g_boxed_copy so only the copy is handed to the callee.
// See #409.
void         CopyBoxedForTransferFullIn (GITypeInfo *type_info, GIArgument *arg, long length);

// For a transfer-full IN GObject argument the callee takes ownership of one
// reference. node-gtk only holds a toggle ref on the wrapper, so add the
// reference the callee expects — otherwise the object is finalized out from
// under the callee once the wrapper is GC'd. See #439.
void         RefObjectForTransferFullIn (GITypeInfo *type_info, GIArgument *arg);

bool         CanConvertV8ToGIArgument (GITypeInfo *type_info, Local<Value> value, bool may_be_null);

bool         V8ToGValue(GValue *gvalue, Local<Value> value, ResourceOwnership ownership = kNone);
Local<Value> GValueToV8(const GValue *gvalue, ResourceOwnership ownership = kNone);
bool         CanConvertV8ToGValue(GValue *gvalue, Local<Value> value);

bool         ValueHasInternalField  (Local<Value> value);
bool         ValueIsInstanceOfGType (Local<Value> value, GType g_type);

};
