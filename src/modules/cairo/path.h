
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>
#include <cairo.h>

namespace GNodeJS {

namespace Cairo {


class Path: public Nan::ObjectWrap {
  public:
    static Nan::Persistent<v8::FunctionTemplate> constructorTemplate;
    static Nan::Persistent<v8::Function>         constructor;
    static void Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target);
    static NAN_METHOD(New);
    static NAN_GETTER(GetStatus);

    Path(cairo_path_t* data);
    ~Path();

    cairo_path_t* _data;
};


}; // Cairo

}; // GNodeJS

