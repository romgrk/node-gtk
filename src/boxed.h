
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>

using v8::Local;
using v8::Handle;
using v8::Function;
using v8::FunctionTemplate;
using v8::Value;

namespace GNodeJS {

/*class BoxedTemplate : public Nan::ObjectWrap {
  public:

    static Local<FunctionTemplate> New (GIBaseInfo *gi_info) ;
    static Local<FunctionTemplate> Get (GType       g_type) ;
    static Local<FunctionTemplate> Get (GIBaseInfo *gi_info) ;

  private:
    BoxedTemplate ();
    ~BoxedTemplate ();
};*/

Local<FunctionTemplate> GetBoxedTemplate (GIBaseInfo *info, GType gtype);
Local<Function>         MakeBoxed        (GIBaseInfo *info);
Local<Value>            WrapperFromBoxed (GIBaseInfo *info, void *data);
void *                  BoxedFromWrapper (Local<Value>);

};
