
#pragma once

#include <node.h>
#include <glib-object.h>

namespace GNodeJS {

GClosure *MakeClosure(v8::Isolate *isolate, v8::Handle<v8::Function> function);

};
