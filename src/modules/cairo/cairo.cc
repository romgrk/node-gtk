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
using v8::MaybeLocal;
using v8::Object;

namespace GNodeJS {

namespace Cairo {

MaybeLocal<FunctionTemplate> GetTemplate(GIBaseInfo *info) {
    auto ns = g_base_info_get_namespace (info);

    if (strcmp(ns, "cairo") != 0)
        return MaybeLocal<FunctionTemplate> ();

    auto name = g_base_info_get_name (info);

    if (strcmp(name, "Context") == 0)
        return MaybeLocal<FunctionTemplate> (Cairo::Context::GetTemplate ());

    return MaybeLocal<FunctionTemplate> ();
}


NAN_METHOD(Init) {
    Local<Object> cairoModule = info[0].As<Object>();

    TextExtent::Initialize(cairoModule);
}

Local<Object> GetModule() {
    auto exports = Nan::New<Object>();

    Nan::Export(exports, "init", Init);

    return exports;
}


}; // System

}; // GnodeJS
