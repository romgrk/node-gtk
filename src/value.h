
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>

using v8::Isolate;
using v8::Value;
using v8::Local;

namespace GNodeJS {

v8::Handle<v8::Value> GIArgumentToV8(v8::Isolate *isolate, GITypeInfo *type_info, GIArgument *argument);
void V8ToGIArgument(v8::Isolate *isolate, GIBaseInfo *base_info, GIArgument *arg, v8::Handle<v8::Value> value);
void V8ToGIArgument(v8::Isolate *isolate, GITypeInfo *type_info, GIArgument *argument, v8::Handle<v8::Value> value, bool may_be_null);
void FreeGIArgument(GITypeInfo *type_info, GIArgument *argument);
Local<Value> GListToV8  (Isolate *isolate, GITypeInfo *info, GList  *glist);
Local<Value> GSListToV8 (Isolate *isolate, GITypeInfo *info, GSList *glist);
Local<Value> GArrayToV8 (Isolate *isolate, GITypeInfo *info, GArray *garray);

void V8ToGValue(GValue *gvalue, v8::Handle<v8::Value> value);
v8::Handle<v8::Value> GValueToV8(v8::Isolate *isolate, const GValue *gvalue);
Local<Value> GIArgumentToV8(Isolate *isolate, GITypeInfo *type_info, GIArgument *argument);
void         V8ToGIArgument(Isolate *isolate, GIBaseInfo *base_info, GIArgument *arg, Local<Value> value);
void         V8ToGIArgument(Isolate *isolate, GITypeInfo *type_info, GIArgument *argument, Local<Value> value, bool may_be_null);
void         FreeGIArgument(GITypeInfo *type_info, GIArgument *argument);

void         V8ToGValue(GValue *gvalue, Local<Value> value);
Local<Value> GValueToV8(Isolate *isolate, const GValue *gvalue);

};
