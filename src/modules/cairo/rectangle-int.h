
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>
#include <cairo.h>

namespace GNodeJS {

namespace Cairo {


class RectangleInt: public Nan::ObjectWrap {
  public:
    static Nan::Persistent<v8::FunctionTemplate> constructorTemplate;
    static Nan::Persistent<v8::Function>         constructor;
    static void Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target);
    static NAN_METHOD(New);
    static NAN_GETTER(GetX);
    static NAN_GETTER(GetY);
    static NAN_GETTER(GetWidth);
    static NAN_GETTER(GetHeight);
    static NAN_SETTER(SetX);
    static NAN_SETTER(SetY);
    static NAN_SETTER(SetWidth);
    static NAN_SETTER(SetHeight);

    RectangleInt(cairo_rectangle_int_t* data);
    ~RectangleInt();

    cairo_rectangle_int_t* _data;
};


}; // Cairo

}; // GNodeJS

