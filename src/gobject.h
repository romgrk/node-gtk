
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

namespace GNodeJS {

using v8::Function;
using v8::Handle;
using v8::Isolate;
using v8::Value;

Handle<Function> MakeClass          (Isolate *isolate, GIBaseInfo *info);
Handle<Value>    WrapperFromGObject (Isolate *isolate, GIBaseInfo *info, GObject *object);
GObject *        GObjectFromWrapper (Handle<Value> value);

};
