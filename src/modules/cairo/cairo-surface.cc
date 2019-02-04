
#include "../../debug.h"
#include "../../gi.h"
#include "../../util.h"
#include "cairo-surface.h"

using namespace v8;


namespace GNodeJS {

namespace Cairo {


Nan::Persistent<FunctionTemplate> Surface::constructorTemplate;
Nan::Persistent<Function>         Surface::constructor;

Nan::Persistent<FunctionTemplate> ImageSurface::constructorTemplate;
Nan::Persistent<Function>         ImageSurface::constructor;


/*
 * Initialize Surface.
 */

void Surface::Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target) {

  // Constructor
  auto tpl = Nan::New<FunctionTemplate>(Surface::New);
  constructorTemplate.Reset(tpl);
  tpl->InstanceTemplate()->SetInternalFieldCount(1);
  tpl->SetClassName(Nan::New("CairoSurface").ToLocalChecked());

  // Prototype
  Local<ObjectTemplate> proto = tpl->PrototypeTemplate();

  auto ctor = tpl->GetFunction();
  constructor.Reset(ctor);

  ImageSurface::Initialize(target, tpl);
}

void ImageSurface::Initialize(
    Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target,
    Local<FunctionTemplate> parentTpl) {

  // Constructor
  auto tpl = Nan::New<FunctionTemplate> (ImageSurface::New);
  ImageSurface::constructorTemplate.Reset (tpl);
  tpl->InstanceTemplate()->SetInternalFieldCount(1);
  tpl->SetClassName (Nan::New ("CairoImageSurface").ToLocalChecked());
  tpl->Inherit (parentTpl);

  // Prototype
  Local<ObjectTemplate> proto = tpl->PrototypeTemplate ();

  auto ctor = tpl->GetFunction();
  ImageSurface::constructor.Reset(ctor);

  Nan::Set (target, Nan::New ("ImageSurface").ToLocalChecked(), ctor);
}

/*
 * Initialize a Surface
 */

NAN_METHOD(Surface::New) {
  return Nan::ThrowTypeError("Cannot instantiate abstract class Surface");
}

NAN_METHOD(ImageSurface::New) {
  if (!info.IsConstructCall()) {
    return Nan::ThrowTypeError("Class constructors cannot be invoked without 'new'");
  }

  cairo_surface_t* data = NULL;

  if (info[0]->IsExternal()) {
    data = (cairo_surface_t*) External::Cast (*info[0])->Value ();
  }
  else if (info.Length() == 3) {
    auto format = (cairo_format_t) Nan::To<int64_t>(info[0].As<Number>()).ToChecked();
    auto width  = Nan::To<int64_t>(info[1].As<Number>()).ToChecked();
    auto height = Nan::To<int64_t>(info[2].As<Number>()).ToChecked();

    data = cairo_image_surface_create (format, width, height);
  }
  else {
    return Nan::ThrowError("Cannot instantiate CairoImageSurface: not enough arguments");
  }

  ImageSurface* surface = new ImageSurface(data);
  surface->Wrap(info.This());

  info.GetReturnValue().Set(info.This());
}

/*
 * Initialize surface.
 */

Surface::Surface(cairo_surface_t* data) : ObjectWrap() {
  _data = data;
}



/*
 * Destroy surface..
 */

Surface::~Surface() {
  if (_data != NULL) {
    cairo_surface_destroy (_data);
  }
}




}; // Cairo

}; // GNodeJS

