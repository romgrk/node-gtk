
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
Local<Value> ArrayToV8  (GITypeInfo *info, gpointer data, int length = -1);
Local<Value> GIArgumentToV8 (GITypeInfo *type_info, GIArgument *argument, int length = -1);

bool         V8ToGIArgument (GITypeInfo *type_info, GIArgument *argument, Local<Value> value);
bool         V8ToGIArgument (GITypeInfo *type_info, GIArgument *argument, Local<Value> value, bool may_be_null);
void         FreeGIArgument (GITypeInfo *type_info, GIArgument *argument, GITransfer transfer = GI_TRANSFER_EVERYTHING);

void         V8ToGValue(GValue *gvalue, Local<Value> value);
Local<Value> GValueToV8(const GValue *gvalue);

};
