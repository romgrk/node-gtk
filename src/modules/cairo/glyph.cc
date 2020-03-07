
#include "../../gi.h"
#include "../../util.h"
#include "glyph.h"

using namespace v8;


namespace GNodeJS {

namespace Cairo {


Nan::Persistent<FunctionTemplate> Glyph::constructorTemplate;
Nan::Persistent<Function>         Glyph::constructor;


/*
 * Initialize Glyph.
 */

void Glyph::Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target) {
  Nan::HandleScope scope;

  // Constructor
  auto tpl = Nan::New<FunctionTemplate>(Glyph::New);
  constructorTemplate.Reset(tpl);
  tpl->InstanceTemplate()->SetInternalFieldCount(1);
  tpl->SetClassName(Nan::New("CairoGlyph").ToLocalChecked());

  // Prototype
  Local<ObjectTemplate> proto = tpl->PrototypeTemplate();
  SetProtoAccessor(proto, UTF8("length"), GetLength, NULL,  tpl);
  Nan::SetIndexedPropertyHandler(proto, IndexGetter);

  auto ctor = Nan::GetFunction (tpl).ToLocalChecked();
  constructor.Reset(ctor);

  Nan::Set(target, Nan::New("Glyph").ToLocalChecked(), ctor);
}

/*
 * Initialize a Glyph with an external
 */

NAN_METHOD(Glyph::New) {
  if (!info.IsConstructCall()) {
    return Nan::ThrowTypeError("Class constructors cannot be invoked without 'new'");
  }

  cairo_glyph_t* data = NULL;
  int64_t length = 0;

  if (info[0]->IsExternal()) {
    data = (cairo_glyph_t*) External::Cast (*info[0])->Value ();
    length = Nan::To<int64_t>(info[1]).ToChecked();
  }
  else {
    return Nan::ThrowError("Cannot instantiate CairoGlyph");
  }

  Glyph* glyph = new Glyph(data, length);
  glyph->Wrap(info.This());

  info.GetReturnValue().Set(info.This());
}

/*
 * Initialize glyph
 */

Glyph::Glyph(cairo_glyph_t* data, int64_t length) : ObjectWrap() {
  _data = data;
  _length = length;
}

/*
 * Destroy glyph
 */

Glyph::~Glyph() {
  if (_data != NULL) {
    cairo_glyph_free (_data);
  }
}

/*
 * Getter/setters
 */

NAN_GETTER(Glyph::GetLength) {
    Glyph *glyph = Nan::ObjectWrap::Unwrap<Glyph>(info.This());
    info.GetReturnValue().Set(Nan::New<Number>(glyph->_length));
}

NAN_INDEX_GETTER(Glyph::IndexGetter) {
  Glyph *glyphs = Nan::ObjectWrap::Unwrap<Glyph>(info.This());
  cairo_glyph_t *glyph = &glyphs->_data[index];

  printf("glyph: %p", glyph);
  Local<Object> returnValue = Nan::New<Object> ();
  Nan::Set (returnValue, UTF8("index"), Nan::New<Number> (glyph->index));
  Nan::Set (returnValue, UTF8("x"),     Nan::New<Number> (glyph->x));
  Nan::Set (returnValue, UTF8("y"),     Nan::New<Number> (glyph->y));
  RETURN(returnValue);
}


}; // Cairo

}; // GNodeJS

