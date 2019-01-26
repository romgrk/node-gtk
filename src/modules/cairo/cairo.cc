#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>
#include <glib-object.h>

#include "../../debug.h"
#include "../../gi.h"
#include "../../gobject.h"
#include "../../value.h"
#include "cairo-context.h"
#include "cairo-text-extent.h"

using v8::Function;
using v8::Local;
using v8::Object;

namespace GNodeJS {

namespace Cairo {

static Local<Function> GetFunction(Local<Object> object, const char* name) {
    auto value = Nan::Get(object, UTF8(name)).ToLocalChecked();
    return Local<Function>::Cast (value);
}


NAN_METHOD(Init) {
    Local<Object> cairoModule = info[0].As<Object>();

    Local<Function> cairoContext = GetFunction(cairoModule, "Context");
    SetupCairoContext(cairoContext);

    TextExtent::Initialize(cairoModule);
}

Local<Object> GetModule() {
    auto exports = Nan::New<Object>();

    Nan::Export(exports, "init", Init);

    return exports;
}


}; // System

}; // GnodeJS
