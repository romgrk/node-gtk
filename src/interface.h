/*
 * interface.h
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>

namespace GNodeJS {

using v8::Local;
using v8::Function;
using v8::FunctionTemplate;
using v8::Isolate;


class Interface: public Nan::ObjectWrap {
  public:
    static Local<FunctionTemplate> GetTemplate (GIInterfaceInfo) ;

  private:
    Interface();
    ~Interface();
   
    static Nan::Persistent<v8::Function> 
}

Local<FunctionTemplate> GetInterfaceTemplate(Isolate *isolate, GIInterfaceInfo *info);
// Local<v8::Value>    WrapperFromBoxed(v8::Isolate *isolate, GIBaseInfo *info, void *data);
// void *              BoxedFromWrapper(v8::Local<v8::Value>);

};
