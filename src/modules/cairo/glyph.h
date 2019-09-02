
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>
#include <cairo.h>

namespace GNodeJS {

namespace Cairo {


class Glyph: public Nan::ObjectWrap {
  public:
    static Nan::Persistent<v8::FunctionTemplate> constructorTemplate;
    static Nan::Persistent<v8::Function>         constructor;
    static void Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target);
    static NAN_METHOD(New);
    static NAN_GETTER(GetLength);
    static NAN_INDEX_GETTER(IndexGetter);

    Glyph(cairo_glyph_t* data, int64_t length);
    ~Glyph();

    cairo_glyph_t* _data;
    int64_t _length;
};


}; // Cairo

}; // GNodeJS

