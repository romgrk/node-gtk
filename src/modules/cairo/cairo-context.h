
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>
#include <cairo.h>

using v8::Local;
using v8::FunctionTemplate;
using v8::Object;

namespace GNodeJS {

namespace Cairo {

namespace Context {

class ContextInfo {
public:
    cairo_t* context;
    Nan::Persistent<Object> *persistent;
};

Local<FunctionTemplate> GetTemplate();

};

};

};
