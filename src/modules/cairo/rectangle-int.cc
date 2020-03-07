
#include "../../gi.h"
#include "../../util.h"
#include "rectangle-int.h"

using namespace v8;


namespace GNodeJS {

namespace Cairo {


Nan::Persistent<FunctionTemplate> RectangleInt::constructorTemplate;
Nan::Persistent<Function>         RectangleInt::constructor;


/*
 * Initialize RectangleInt.
 */

void RectangleInt::Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target) {
  Nan::HandleScope scope;

  // Constructor
  auto tpl = Nan::New<FunctionTemplate>(RectangleInt::New);
  constructorTemplate.Reset(tpl);
  tpl->InstanceTemplate()->SetInternalFieldCount(1);
  tpl->SetClassName(Nan::New("CairoRectangleInt").ToLocalChecked());

  // Prototype
  Local<ObjectTemplate> proto = tpl->PrototypeTemplate();
  SetProtoAccessor(proto, UTF8("x"),      GetX,      SetX,      tpl);
  SetProtoAccessor(proto, UTF8("y"),      GetY,      SetY,      tpl);
  SetProtoAccessor(proto, UTF8("width"),  GetWidth,  SetWidth,  tpl);
  SetProtoAccessor(proto, UTF8("height"), GetHeight, SetHeight, tpl);

  auto ctor = Nan::GetFunction (tpl).ToLocalChecked();
  constructor.Reset(ctor);

  Nan::Set(target, Nan::New("RectangleInt").ToLocalChecked(), ctor);
}

/*
 * Initialize a RectangleInt with the given width and height.
 */

NAN_METHOD(RectangleInt::New) {
  if (!info.IsConstructCall()) {
    return Nan::ThrowTypeError("Class constructors cannot be invoked without 'new'");
  }

  cairo_rectangle_int_t* data = NULL;

  if (info[0]->IsExternal()) {
    data = (cairo_rectangle_int_t*) External::Cast (*info[0])->Value ();
  }
  else {
    data = new cairo_rectangle_int_t();

    if (info.Length() == 4) {
        data->x      = Nan::To<int64_t>(info[0].As<Number>()).ToChecked();
        data->y      = Nan::To<int64_t>(info[1].As<Number>()).ToChecked();
        data->width  = Nan::To<int64_t>(info[2].As<Number>()).ToChecked();
        data->height = Nan::To<int64_t>(info[3].As<Number>()).ToChecked();
    }
  }

  RectangleInt* rectangle_int = new RectangleInt(data);
  rectangle_int->Wrap(info.This());

  info.GetReturnValue().Set(info.This());
}

/*
 * Initialize text extent.
 */

RectangleInt::RectangleInt(cairo_rectangle_int_t* data) : ObjectWrap() {
  _data = data;
}

/*
 * Destroy text extent..
 */

RectangleInt::~RectangleInt() {
  if (_data != NULL) {
    delete _data;
  }
}

/*
 * Getter/setters
 */

#define DEFINE_ACCESSORS(prop, getterName, setterName) \
  NAN_GETTER(RectangleInt::getterName) { \
    RectangleInt *rectangle_int = Nan::ObjectWrap::Unwrap<RectangleInt>(info.This()); \
    info.GetReturnValue().Set(Nan::New<Number>(rectangle_int->_data->prop)); \
  } \
 \
  NAN_SETTER(RectangleInt::setterName) { \
    if (value->IsNumber()) { \
      RectangleInt *rectangle_int = Nan::ObjectWrap::Unwrap<RectangleInt>(info.This()); \
      rectangle_int->_data->prop = Nan::To<int64_t> (value).ToChecked(); \
    } \
  }

DEFINE_ACCESSORS(x,      GetX, SetX)
DEFINE_ACCESSORS(y,      GetY, SetY)
DEFINE_ACCESSORS(width,  GetWidth,  SetWidth)
DEFINE_ACCESSORS(height, GetHeight, SetHeight)

#undef DEFINE_ACCESSORS


}; // Cairo

}; // GNodeJS

