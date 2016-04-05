
#pragma once

#include <node.h>
#include <girepository.h>

using v8::Local;
using v8::Handle;
using v8::Function;
using v8::Isolate;

namespace GNodeJS {

Handle<Function>    MakeBoxed(Isolate *isolate, GIBaseInfo *info);
Local<v8::Value>    WrapperFromBoxed(v8::Isolate *isolate, GIBaseInfo *info, void *data);
void *              BoxedFromWrapper(v8::Local<v8::Value>);

};
