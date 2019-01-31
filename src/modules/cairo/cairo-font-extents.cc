
#include "../../gi.h"
#include "../../util.h"
#include "cairo-font-extents.h"

using namespace v8;


namespace GNodeJS {

namespace Cairo {


Nan::Persistent<FunctionTemplate> FontExtents::constructor;


/*
 * Initialize FontExtents.
 */

void FontExtents::Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target) {
  Nan::HandleScope scope;

  // Constructor
  Local<FunctionTemplate> ctor = Nan::New<FunctionTemplate>(FontExtents::New);
  constructor.Reset(ctor);
  ctor->InstanceTemplate()->SetInternalFieldCount(1);
  ctor->SetClassName(Nan::New("CairoFontExtents").ToLocalChecked());

  // Prototype
  Local<ObjectTemplate> proto = ctor->PrototypeTemplate();
  SetProtoAccessor(proto, UTF8("ascent"),   GetAscent,   SetAscent,   ctor);
  SetProtoAccessor(proto, UTF8("descent"),  GetDescent,  SetDescent,  ctor);
  SetProtoAccessor(proto, UTF8("height"),   GetHeight,   SetHeight,   ctor);
  SetProtoAccessor(proto, UTF8("maxXAdvance"), GetMaxXAdvance, SetMaxXAdvance, ctor);
  SetProtoAccessor(proto, UTF8("maxYAdvance"), GetMaxYAdvance, SetMaxYAdvance, ctor);

  Nan::Set(target, Nan::New("FontExtents").ToLocalChecked(), ctor->GetFunction());
}

/*
 * Initialize a FontExtents with the given width and height.
 */

NAN_METHOD(FontExtents::New) {
  if (!info.IsConstructCall()) {
    return Nan::ThrowTypeError("Class constructors cannot be invoked without 'new'");
  }

  cairo_font_extents_t* data = NULL;

  if (info[0]->IsExternal()) {
    data = (cairo_font_extents_t*) External::Cast (*info[0])->Value ();
  }
  else {
    data = new cairo_font_extents_t();
  }

  FontExtents* fontExtents = new FontExtents(data);
  fontExtents->Wrap(info.This());

  info.GetReturnValue().Set(info.This());
}

/*
 * Initialize text extent.
 */

FontExtents::FontExtents(cairo_font_extents_t* data) : ObjectWrap() {
  _data = data;
}

/*
 * Destroy text extent..
 */

FontExtents::~FontExtents() {
  if (_data != NULL) {
    delete _data;
  }
}

/*
 * Getter/setters
 */

#define DEFINE_ACCESSORS(prop, getterName, setterName) \
  NAN_GETTER(FontExtents::getterName) { \
    FontExtents *fontExtents = Nan::ObjectWrap::Unwrap<FontExtents>(info.This()); \
    info.GetReturnValue().Set(Nan::New<Number>(fontExtents->_data->prop)); \
  } \
 \
  NAN_SETTER(FontExtents::setterName) { \
    if (value->IsNumber()) { \
      FontExtents *fontExtents = Nan::ObjectWrap::Unwrap<FontExtents>(info.This()); \
      fontExtents->_data->prop = Nan::To<double> (value).ToChecked(); \
    } \
  }

DEFINE_ACCESSORS(ascent,        GetAscent,      SetAscent)
DEFINE_ACCESSORS(descent,       GetDescent,     SetDescent)
DEFINE_ACCESSORS(height,        GetHeight,      SetHeight)
DEFINE_ACCESSORS(max_x_advance, GetMaxXAdvance, SetMaxXAdvance)
DEFINE_ACCESSORS(max_y_advance, GetMaxYAdvance, SetMaxYAdvance)






#undef DEFINE_ACCESSORS


}; // Cairo

}; // GNodeJS

