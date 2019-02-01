
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>
#include <cairo.h>

namespace GNodeJS {

namespace Cairo {


class Surface: public Nan::ObjectWrap {
  public:
    static Nan::Persistent<v8::FunctionTemplate> constructorTemplate;
    static Nan::Persistent<v8::Function>         constructor;
    static void Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target);
    static NAN_METHOD(New);

    Surface(cairo_surface_t* data);
    ~Surface();

    cairo_surface_t* _data;
};

/*
 * ImageSurface
 * PDFSurface
 * PostScriptSurface
 * RecordingSurface
 * Win32Surface
 * SVGSurface
 * QuartzSurface
 * XCBSurface
 * XlibSurface
 * ScriptSurface
 */

class ImageSurface: public Surface {
  public:
    static Nan::Persistent<v8::FunctionTemplate> constructorTemplate;
    static Nan::Persistent<v8::Function>         constructor;
    static void Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target, v8::Local<v8::FunctionTemplate> parentTpl);
    static NAN_METHOD(New);

    ImageSurface(cairo_surface_t* data) : Surface(data) {};
};

}; // Cairo

}; // GNodeJS

