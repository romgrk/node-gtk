
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>

using v8::Local;
using v8::Object;

namespace GNodeJS {

namespace Cairo {

Local<Object> GetModule();

};

};
