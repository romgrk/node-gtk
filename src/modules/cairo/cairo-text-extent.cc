
#include "../../gi.h"
#include "../../util.h"
#include "cairo-text-extent.h"

using namespace v8;


namespace GNodeJS {

namespace Cairo {


Nan::Persistent<FunctionTemplate> TextExtent::constructor;


/*
 * Initialize TextExtent.
 */

void TextExtent::Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target) {
  Nan::HandleScope scope;

  // Constructor
  Local<FunctionTemplate> ctor = Nan::New<FunctionTemplate>(TextExtent::New);
  constructor.Reset(ctor);
  ctor->InstanceTemplate()->SetInternalFieldCount(1);
  ctor->SetClassName(Nan::New("CairoTextExtent").ToLocalChecked());

  // Prototype
  Local<ObjectTemplate> proto = ctor->PrototypeTemplate();
  SetProtoAccessor(proto, UTF8("xBearing"), GetXBearing, SetXBearing,  ctor);
  SetProtoAccessor(proto, UTF8("yBearing"), GetYBearing, SetYBearing, ctor);
  SetProtoAccessor(proto, UTF8("width"),    GetWidth,  SetWidth,  ctor);
  SetProtoAccessor(proto, UTF8("height"),   GetHeight, SetHeight, ctor);
  SetProtoAccessor(proto, UTF8("xAdvance"), GetXAdvance, SetXAdvance,  ctor);
  SetProtoAccessor(proto, UTF8("yAdvance"), GetYAdvance, SetYAdvance, ctor);

  Nan::Set(target, Nan::New("TextExtent").ToLocalChecked(), ctor->GetFunction());
}

/*
 * Initialize a TextExtent with the given width and height.
 */

NAN_METHOD(TextExtent::New) {
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

  TextExtent* textExtent = new TextExtent(data);
  textExtent->Wrap(info.This());

  info.GetReturnValue().Set(info.This());
}

/*
 * Initialize text extent.
 */

TextExtent::TextExtent(cairo_text_extents_t* data) : ObjectWrap() {
  _data = data;
}

/*
 * Destroy text extent..
 */

TextExtent::~TextExtent() {
  if (_data != NULL) {
    delete _data;
  }
}

/*
 * Getter/setters
 */

#define DEFINE_ACCESSORS(prop, getterName, setterName) \
  NAN_GETTER(TextExtent::getterName) { \
    TextExtent *textExtent = Nan::ObjectWrap::Unwrap<TextExtent>(info.This()); \
    info.GetReturnValue().Set(Nan::New<Number>(textExtent->_data->prop)); \
  } \
 \
  NAN_SETTER(TextExtent::setterName) { \
    if (value->IsNumber()) { \
      TextExtent *textExtent = Nan::ObjectWrap::Unwrap<TextExtent>(info.This()); \
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

