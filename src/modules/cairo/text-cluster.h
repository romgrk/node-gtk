
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>
#include <cairo.h>

namespace GNodeJS {

namespace Cairo {


class TextCluster: public Nan::ObjectWrap {
  public:
    static Nan::Persistent<v8::FunctionTemplate> constructorTemplate;
    static Nan::Persistent<v8::Function>         constructor;
    static void Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target);
    static NAN_METHOD(New);
    static NAN_GETTER(GetLength);
    static NAN_GETTER(GetFlags);
    static NAN_INDEX_GETTER(IndexGetter);

    TextCluster(cairo_text_cluster_t* data, int64_t length, cairo_text_cluster_flags_t flags);
    ~TextCluster();

    cairo_text_cluster_t* _data;
    int64_t _length;
    cairo_text_cluster_flags_t _flags;
};


}; // Cairo

}; // GNodeJS

