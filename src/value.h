
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>

using v8::Value;
using v8::Local;

namespace GNodeJS {

Local<Value> GListToV8  (GITypeInfo *info, GList  *glist);
Local<Value> GSListToV8 (GITypeInfo *info, GSList *glist);
Local<Value> ArrayToV8  (GITypeInfo *info, gpointer data);

Local<Value> GIArgumentToV8 (GITypeInfo *type_info, GIArgument *argument);
bool         V8ToGIArgument (GITypeInfo *type_info, GIArgument *argument, Local<Value> value);
bool         V8ToGIArgument (GITypeInfo *type_info, GIArgument *argument, Local<Value> value, bool may_be_null);
void         FreeGIArgument (GITypeInfo *type_info, GIArgument *argument);

void         V8ToGValue(GValue *gvalue, Local<Value> value);
Local<Value> GValueToV8(const GValue *gvalue);

};
