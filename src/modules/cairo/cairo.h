
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>

using v8::FunctionTemplate;
using v8::Local;
using v8::MaybeLocal;
using v8::Object;

namespace GNodeJS {

namespace Cairo {

MaybeLocal<FunctionTemplate> GetTemplate(GIBaseInfo *info);
Local<Object> GetModule();

};

};
