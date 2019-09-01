
#include "../../gi.h"
#include "../../util.h"
#include "rectangle.h"

using namespace v8;


namespace GNodeJS {

namespace Cairo {


Nan::Persistent<FunctionTemplate> Rectangle::constructorTemplate;
Nan::Persistent<Function>         Rectangle::constructor;


/*
 * Initialize Rectangle.
 */

void Rectangle::Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target) {
  Nan::HandleScope scope;

  // Constructor
  auto tpl = Nan::New<FunctionTemplate>(Rectangle::New);
  constructorTemplate.Reset(tpl);
  tpl->InstanceTemplate()->SetInternalFieldCount(1);
  tpl->SetClassName(Nan::New("CairoRectangle").ToLocalChecked());

  // Prototype
  Local<ObjectTemplate> proto = tpl->PrototypeTemplate();
  SetProtoAccessor(proto, UTF8("x"),      GetX,      SetX,      tpl);
  SetProtoAccessor(proto, UTF8("y"),      GetY,      SetY,      tpl);
  SetProtoAccessor(proto, UTF8("width"),  GetWidth,  SetWidth,  tpl);
  SetProtoAccessor(proto, UTF8("height"), GetHeight, SetHeight, tpl);

  auto ctor = Nan::GetFunction (tpl).ToLocalChecked();
  constructor.Reset(ctor);

  Nan::Set(target, Nan::New("Rectangle").ToLocalChecked(), ctor);
}

/*
 * Initialize a Rectangle with the given width and height.
 */

NAN_METHOD(Rectangle::New) {
  if (!info.IsConstructCall()) {
    return Nan::ThrowTypeError("Class constructors cannot be invoked without 'new'");
  }

  cairo_rectangle_t* data = NULL;

  if (info[0]->IsExternal()) {
    data = (cairo_rectangle_t*) External::Cast (*info[0])->Value ();
  }
  else {
    data = new cairo_rectangle_t();

    if (info.Length() == 4) {
        data->x      = Nan::To<double>(info[0].As<Number>()).ToChecked();
        data->y      = Nan::To<double>(info[1].As<Number>()).ToChecked();
        data->width  = Nan::To<double>(info[2].As<Number>()).ToChecked();
        data->height = Nan::To<double>(info[3].As<Number>()).ToChecked();
    }
  }

  Rectangle* rectangle = new Rectangle(data);
  rectangle->Wrap(info.This());

  info.GetReturnValue().Set(info.This());
}

/*
 * Initialize text extent.
 */

Rectangle::Rectangle(cairo_rectangle_t* data) : ObjectWrap() {
  _data = data;
}

/*
 * Destroy text extent..
 */

Rectangle::~Rectangle() {
  if (_data != NULL) {
    delete _data;
  }
}

/*
 * Getter/setters
 */

#define DEFINE_ACCESSORS(prop, getterName, setterName) \
  NAN_GETTER(Rectangle::getterName) { \
    Rectangle *rectangle = Nan::ObjectWrap::Unwrap<Rectangle>(info.This()); \
    info.GetReturnValue().Set(Nan::New<Number>(rectangle->_data->prop)); \
  } \
 \
  NAN_SETTER(Rectangle::setterName) { \
    if (value->IsNumber()) { \
      Rectangle *rectangle = Nan::ObjectWrap::Unwrap<Rectangle>(info.This()); \
      rectangle->_data->prop = Nan::To<double> (value).ToChecked(); \
    } \
  }

DEFINE_ACCESSORS(x,      GetX, SetX)
DEFINE_ACCESSORS(y,      GetY, SetY)
DEFINE_ACCESSORS(width,  GetWidth,  SetWidth)
DEFINE_ACCESSORS(height, GetHeight, SetHeight)

#undef DEFINE_ACCESSORS


}; // Cairo

}; // GNodeJS

