
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

namespace GNodeJS {

using v8::Function;
using v8::FunctionTemplate;
using v8::Handle;
using v8::Isolate;
using v8::Value;

class Template : public Nan::ObjectWrap {
  public:

  private:
    ~Template() ;

    void New                (const Nan::FunctionCallbackInfo<v8::Value>& info) ;
    void GetProperty        (v8::Local<v8::String> property, const Nan::PropertyCallbackInfo<v8::Value>& info) ;
    void SetProperty        (v8::Local<v8::String> property, const Nan::PropertyCallbackInfo<v8::Value>& info) ;
};


Handle<Function> MakeClass          (Isolate *isolate, GIBaseInfo *info);
Handle<Value>    WrapperFromGObject (Isolate *isolate, GObject *object);
void             InstallFunction    (Isolate *isolate, Handle<FunctionTemplate> tpl, GIFunctionInfo *func);
GObject *        GObjectFromWrapper (Handle<Value> value);

};
