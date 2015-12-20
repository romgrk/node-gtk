
#pragma once

#include <node.h>
#include <girepository.h>

namespace GNodeJS {

v8::Handle<v8::Value> GIArgumentToV8(v8::Isolate *isolate, GITypeInfo *type_info, GIArgument *argument);
void V8ToGIArgument(v8::Isolate *isolate, GIBaseInfo *base_info, GIArgument *arg, v8::Handle<v8::Value> value);
void V8ToGIArgument(v8::Isolate *isolate, GITypeInfo *type_info, GIArgument *argument, v8::Handle<v8::Value> value, bool may_be_null);
void FreeGIArgument(GITypeInfo *type_info, GIArgument *argument);

void V8ToGValue(GValue *gvalue, v8::Handle<v8::Value> value);
v8::Handle<v8::Value> GValueToV8(v8::Isolate *isolate, const GValue *gvalue);

};
