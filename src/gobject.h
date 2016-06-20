
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::Isolate;
using v8::Value;

namespace GNodeJS {

class Template : public Nan::ObjectWrap {
  public:
  private:
    ~Template() ;
    void New                (const Nan::FunctionCallbackInfo<v8::Value>& info) ;
    void GetProperty        (v8::Local<v8::String> property, const Nan::PropertyCallbackInfo<v8::Value>& info) ;
    void SetProperty        (v8::Local<v8::String> property, const Nan::PropertyCallbackInfo<v8::Value>& info) ;
};


Local<Function> MakeClass          (GIBaseInfo *info);
Local<Value>    WrapperFromGObject (GObject *object);
GObject *       GObjectFromWrapper (Local<Value> value);

};
