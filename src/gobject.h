
#pragma once

#include <node.h>
#include <girepository.h>
#include <glib-object.h>

namespace GNodeJS {

v8::Handle<v8::Function> MakeClass(v8::Isolate *isolate, GIBaseInfo *info);

v8::Handle<v8::Value> WrapperFromGObject(v8::Isolate *isolate, GObject *object);
GObject * GObjectFromWrapper(v8::Handle<v8::Value> value);

};
