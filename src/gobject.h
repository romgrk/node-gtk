
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::MaybeLocal;
using v8::Isolate;
using v8::Value;

namespace GNodeJS {

MaybeLocal<Function>    MakeClass            (GIBaseInfo *info);
Local<Value>            WrapperFromGObject   (GObject *object);
GObject *               GObjectFromWrapper   (Local<Value> value);
Local<FunctionTemplate> GetBaseClassTemplate ();
Local<Value>            GetGObjectProperty   (GObject * gobject, const char *prop_name);
Local<v8::Boolean>          SetGObjectProperty   (GObject * gobject, const char *prop_name, Local<Value> value);

};
