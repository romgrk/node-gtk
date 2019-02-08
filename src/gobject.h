
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::Isolate;
using v8::Value;

namespace GNodeJS {

Local<Function>         MakeClass            (GIBaseInfo *info);
Local<Value>            WrapperFromGObject   (GObject *object, GIBaseInfo *info = NULL);
GObject *               GObjectFromWrapper   (Local<Value> value);
Local<FunctionTemplate> GetBaseClassTemplate ();

};
