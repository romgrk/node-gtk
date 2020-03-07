
#include "../../gi.h"
#include "../../util.h"
#include "path.h"

using namespace v8;


namespace GNodeJS {

namespace Cairo {


Nan::Persistent<FunctionTemplate> Path::constructorTemplate;
Nan::Persistent<Function>         Path::constructor;


/*
 * Initialize Path.
 */

void Path::Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target) {
  Nan::HandleScope scope;

  // Constructor
  auto tpl = Nan::New<FunctionTemplate>(Path::New);
  constructorTemplate.Reset(tpl);
  tpl->InstanceTemplate()->SetInternalFieldCount(1);
  tpl->SetClassName(Nan::New("CairoPath").ToLocalChecked());

  // Prototype
  Local<ObjectTemplate> proto = tpl->PrototypeTemplate();
  SetProtoAccessor(proto, UTF8("status"), GetStatus, NULL,  tpl);

  auto ctor = Nan::GetFunction (tpl).ToLocalChecked();
  constructor.Reset(ctor);

  Nan::Set(target, Nan::New("Path").ToLocalChecked(), ctor);
}

/*
 * Initialize a Path with an external
 */

NAN_METHOD(Path::New) {
  if (!info.IsConstructCall()) {
    return Nan::ThrowTypeError("Class constructors cannot be invoked without 'new'");
  }

  cairo_path_t* data = NULL;

  if (info[0]->IsExternal()) {
    data = (cairo_path_t*) External::Cast (*info[0])->Value ();
  }
  else {
    return Nan::ThrowError("Cannot instantiate CairoPath");
  }

  Path* path = new Path(data);
  path->Wrap(info.This());

  info.GetReturnValue().Set(info.This());
}

/*
 * Initialize path
 */

Path::Path(cairo_path_t* data) : ObjectWrap() {
  _data = data;
}

/*
 * Destroy path
 */

Path::~Path() {
  if (_data != NULL) {
    cairo_path_destroy (_data);
  }
}

/*
 * Getter/setters
 */

NAN_GETTER(Path::GetStatus) {
    Path *path = Nan::ObjectWrap::Unwrap<Path>(info.This());
    info.GetReturnValue().Set(Nan::New<Number>(path->_data->status));
}


}; // Cairo

}; // GNodeJS

