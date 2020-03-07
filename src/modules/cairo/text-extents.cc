
#include "../../gi.h"
#include "../../util.h"
#include "text-extents.h"

using namespace v8;


namespace GNodeJS {

namespace Cairo {


Nan::Persistent<FunctionTemplate> TextExtents::constructorTemplate;
Nan::Persistent<Function>         TextExtents::constructor;


/*
 * Initialize TextExtents.
 */

void TextExtents::Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target) {
  Nan::HandleScope scope;

  // Constructor
  auto tpl = Nan::New<FunctionTemplate>(TextExtents::New);
  constructorTemplate.Reset(tpl);
  tpl->InstanceTemplate()->SetInternalFieldCount(1);
  tpl->SetClassName(Nan::New("CairoTextExtents").ToLocalChecked());

  // Prototype
  Local<ObjectTemplate> proto = tpl->PrototypeTemplate();
  SetProtoAccessor(proto, UTF8("xBearing"), GetXBearing, SetXBearing,  tpl);
  SetProtoAccessor(proto, UTF8("yBearing"), GetYBearing, SetYBearing, tpl);
  SetProtoAccessor(proto, UTF8("width"),    GetWidth,  SetWidth,  tpl);
  SetProtoAccessor(proto, UTF8("height"),   GetHeight, SetHeight, tpl);
  SetProtoAccessor(proto, UTF8("xAdvance"), GetXAdvance, SetXAdvance,  tpl);
  SetProtoAccessor(proto, UTF8("yAdvance"), GetYAdvance, SetYAdvance, tpl);

  auto ctor = Nan::GetFunction (tpl).ToLocalChecked();
  constructor.Reset(ctor);

  Nan::Set(target, Nan::New("TextExtents").ToLocalChecked(), ctor);
}

/*
 * Initialize a TextExtents with the given width and height.
 */

NAN_METHOD(TextExtents::New) {
  if (!info.IsConstructCall()) {
    return Nan::ThrowTypeError("Class constructors cannot be invoked without 'new'");
  }

  cairo_text_extents_t* data = NULL;

  if (info[0]->IsExternal()) {
    data = (cairo_text_extents_t*) External::Cast (*info[0])->Value ();
  }
  else {
    data = new cairo_text_extents_t();
  }

  TextExtents* textExtent = new TextExtents(data);
  textExtent->Wrap(info.This());

  info.GetReturnValue().Set(info.This());
}

/*
 * Initialize text extent.
 */

TextExtents::TextExtents(cairo_text_extents_t* data) : ObjectWrap() {
  _data = data;
}

/*
 * Destroy text extent..
 */

TextExtents::~TextExtents() {
  if (_data != NULL) {
    delete _data;
  }
}

/*
 * Getter/setters
 */

#define DEFINE_ACCESSORS(prop, getterName, setterName) \
  NAN_GETTER(TextExtents::getterName) { \
    TextExtents *textExtent = Nan::ObjectWrap::Unwrap<TextExtents>(info.This()); \
    info.GetReturnValue().Set(Nan::New<Number>(textExtent->_data->prop)); \
  } \
 \
  NAN_SETTER(TextExtents::setterName) { \
    if (value->IsNumber()) { \
      TextExtents *textExtent = Nan::ObjectWrap::Unwrap<TextExtents>(info.This()); \
      textExtent->_data->prop = Nan::To<double> (value).ToChecked(); \
    } \
  }

DEFINE_ACCESSORS(x_bearing, GetXBearing, SetXBearing)
DEFINE_ACCESSORS(y_bearing, GetYBearing, SetYBearing)
DEFINE_ACCESSORS(width,     GetWidth,  SetWidth)
DEFINE_ACCESSORS(height,    GetHeight, SetHeight)
DEFINE_ACCESSORS(x_advance, GetXAdvance, SetXAdvance)
DEFINE_ACCESSORS(y_advance, GetYAdvance, SetYAdvance)

#undef DEFINE_ACCESSORS


}; // Cairo

}; // GNodeJS

