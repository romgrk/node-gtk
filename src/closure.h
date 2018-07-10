
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

namespace GNodeJS {

GClosure *MakeClosure(v8::Isolate *isolate, v8::Handle<v8::Function> function, GISignalInfo* info);

};
