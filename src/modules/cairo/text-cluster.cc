
#include "../../gi.h"
#include "../../util.h"
#include "text-cluster.h"

using namespace v8;


namespace GNodeJS {

namespace Cairo {


Nan::Persistent<FunctionTemplate> TextCluster::constructorTemplate;
Nan::Persistent<Function>         TextCluster::constructor;


/*
 * Initialize TextCluster.
 */

void TextCluster::Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target) {
  Nan::HandleScope scope;

  // Constructor
  auto tpl = Nan::New<FunctionTemplate>(TextCluster::New);
  constructorTemplate.Reset(tpl);
  tpl->InstanceTemplate()->SetInternalFieldCount(1);
  tpl->SetClassName(Nan::New("CairoTextCluster").ToLocalChecked());

  // Prototype
  Local<ObjectTemplate> proto = tpl->PrototypeTemplate();
  SetProtoAccessor(proto, UTF8("length"), GetLength, NULL,  tpl);
  SetProtoAccessor(proto, UTF8("flags"),  GetFlags,  NULL,  tpl);
  Nan::SetIndexedPropertyHandler(proto, IndexGetter);

  auto ctor = Nan::GetFunction (tpl).ToLocalChecked();
  constructor.Reset(ctor);

  Nan::Set(target, Nan::New("TextCluster").ToLocalChecked(), ctor);
}

/*
 * Initialize a TextCluster with an external
 */

NAN_METHOD(TextCluster::New) {
  if (!info.IsConstructCall()) {
    return Nan::ThrowTypeError("Class constructors cannot be invoked without 'new'");
  }

  cairo_text_cluster_t* data = NULL;
  int64_t length = 0;
  cairo_text_cluster_flags_t flags;

  if (info[0]->IsExternal()) {
    data = (cairo_text_cluster_t*) External::Cast (*info[0])->Value ();
    length = Nan::To<int64_t>(info[1]).ToChecked();
    flags = static_cast<cairo_text_cluster_flags_t>(Nan::To<int32_t>(info[2]).ToChecked());
  }
  else {
    return Nan::ThrowError("Cannot instantiate CairoTextCluster");
  }

  TextCluster* text_cluster = new TextCluster(data, length, flags);
  text_cluster->Wrap(info.This());

  info.GetReturnValue().Set(info.This());
}

/*
 * Initialize text_cluster
 */

TextCluster::TextCluster(cairo_text_cluster_t* data, int64_t length, cairo_text_cluster_flags_t flags) : ObjectWrap() {
  _data = data;
  _length = length;
  _flags = flags;
}

/*
 * Destroy text_cluster
 */

TextCluster::~TextCluster() {
  if (_data != NULL) {
    cairo_text_cluster_free (_data);
  }
}

/*
 * Getter/setters
 */

NAN_GETTER(TextCluster::GetLength) {
    TextCluster *text_cluster = Nan::ObjectWrap::Unwrap<TextCluster>(info.This());
    info.GetReturnValue().Set(Nan::New<Number>(text_cluster->_length));
}

NAN_GETTER(TextCluster::GetFlags) {
    TextCluster *text_cluster = Nan::ObjectWrap::Unwrap<TextCluster>(info.This());
    info.GetReturnValue().Set(Nan::New<Number>(text_cluster->_flags));
}

NAN_INDEX_GETTER(TextCluster::IndexGetter) {
  TextCluster *text_clusters = Nan::ObjectWrap::Unwrap<TextCluster>(info.This());
  cairo_text_cluster_t *text_cluster = &text_clusters->_data[index];

  Local<Object> returnValue = Nan::New<Object> ();
  Nan::Set (returnValue, UTF8("num_bytes"),  Nan::New<Number> (text_cluster->num_bytes));
  Nan::Set (returnValue, UTF8("num_glyphs"), Nan::New<Number> (text_cluster->num_glyphs));
  RETURN(returnValue);
}


}; // Cairo

}; // GNodeJS

