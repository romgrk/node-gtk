
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>

using v8::Local;
using v8::Function;

namespace GNodeJS {

namespace Cairo {

void SetupCairoContext(Local<Function> cairoContext);

};

};
