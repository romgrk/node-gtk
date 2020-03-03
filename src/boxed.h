
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>

using v8::External;
using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;

namespace GNodeJS {

class Boxed {
public:
    void* data;
    GType g_type;
    GIBaseInfo * info;
    unsigned long size;
    Nan::Persistent<Object> *persistent;

    static size_t GetSize (GIBaseInfo *boxed_info) ;
};

Local<Function>         MakeBoxedClass   (GIBaseInfo *info);
Local<FunctionTemplate> GetBoxedTemplate (GIBaseInfo *info, GType gtype);
Local<Value>            WrapperFromBoxed (GIBaseInfo *info, void *data);
void *                  PointerFromWrapper (Local<Value>);

};
