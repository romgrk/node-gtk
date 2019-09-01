
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>
#include <cairo.h>

namespace GNodeJS {

namespace Cairo {


class FontExtents: public Nan::ObjectWrap {
  public:
    static Nan::Persistent<v8::FunctionTemplate> constructorTemplate;
    static Nan::Persistent<v8::Function>         constructor;
    static void Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target);
    static NAN_METHOD(New);
    static NAN_GETTER(GetAscent);
    static NAN_GETTER(GetDescent);
    static NAN_GETTER(GetHeight);
    static NAN_GETTER(GetMaxXAdvance);
    static NAN_GETTER(GetMaxYAdvance);
    static NAN_SETTER(SetAscent);
    static NAN_SETTER(SetDescent);
    static NAN_SETTER(SetHeight);
    static NAN_SETTER(SetMaxXAdvance);
    static NAN_SETTER(SetMaxYAdvance);

    FontExtents(cairo_font_extents_t* data);
    ~FontExtents();

    cairo_font_extents_t* _data;
};


}; // Cairo

}; // GNodeJS

