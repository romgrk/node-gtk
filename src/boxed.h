
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>

#include "debug.h"

using v8::External;
using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;

namespace GNodeJS {

struct Boxed {
    void       *data;
    GIBaseInfo *info;
};

class BoxedContainer {
public:
    void                    *data;
    GType                    g_type;
    Nan::Persistent<Object> *persistent;
};

Local<Function>         MakeBoxedClass   (GIBaseInfo *info);
Local<FunctionTemplate> GetBoxedTemplate (GIBaseInfo *info, GType gtype);
Local<Value>            WrapperFromBoxed (GIBaseInfo *info, void *data);
void *                  BoxedFromWrapper (Local<Value>);

};
