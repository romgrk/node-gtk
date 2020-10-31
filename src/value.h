
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib.h>

using v8::Value;
using v8::Local;

namespace GNodeJS {

Local<Value> GListToV8  (GITypeInfo *info, GList  *glist);
Local<Value> GSListToV8 (GITypeInfo *info, GSList *glist);
Local<Value> GHashToV8 (GITypeInfo *info, GHashTable *hash);
Local<Value> ArrayToV8  (GITypeInfo *info, gpointer data, long length = -1);
Local<Value> GErrorToV8 (GITypeInfo *type_info, GError *err);
Local<Value> GIArgumentToV8 (GITypeInfo *type_info, GIArgument *argument, long length = -1, bool mustCopy = false);
long         GIArgumentToLength(GITypeInfo *type_info, GIArgument *arg, bool is_pointer);

bool         V8ToGIArgument (GITypeInfo *type_info, GIArgument *argument, Local<Value> value);
bool         V8ToGIArgument (GITypeInfo *type_info, GIArgument *argument, Local<Value> value, bool may_be_null);
void         FreeGIArgument (GITypeInfo *type_info, GIArgument *argument, GITransfer transfer = GI_TRANSFER_EVERYTHING, GIDirection direction = GI_DIRECTION_OUT);
void         FreeGIArgumentArray (GITypeInfo *type_info, GIArgument *arg, GITransfer transfer = GI_TRANSFER_EVERYTHING, GIDirection direction = GI_DIRECTION_OUT, long length = -1);
bool         CanConvertV8ToGIArgument (GITypeInfo *type_info, Local<Value> value, bool may_be_null);

bool         V8ToGValue(GValue *gvalue, Local<Value> value, bool mustCopy = false) __attribute__((warn_unused_result));
Local<Value> GValueToV8(const GValue *gvalue, bool mustCopy = false);
bool         CanConvertV8ToGValue(GValue *gvalue, Local<Value> value);

bool         ValueHasInternalField  (Local<Value> value);
bool         ValueIsInstanceOfGType (Local<Value> value, GType g_type);

};
