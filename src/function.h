
#pragma once

#include <node.h>
#include <girepository.h>
#include <girffi.h>

namespace GNodeJS {

v8::Handle<v8::Function> MakeFunction(v8::Isolate *isolate, GIBaseInfo *base_info);

};
