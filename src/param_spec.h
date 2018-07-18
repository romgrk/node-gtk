
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::Value;
using Nan::Persistent;

namespace GNodeJS {

class ParamSpec : public Nan::ObjectWrap {

private:
    ~ParamSpec();
    GParamSpec *data;

    static Persistent<Function> instance_constructor;
    static Local<Function> GetConstructor();

public:
    static Local<Value> FromGParamSpec(GParamSpec *param_spec, bool makeCopy = true);
    static GParamSpec*  FromWrapper(Local<Value> object);
};


};
