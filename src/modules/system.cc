
#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>
#include <glib-object.h>


#include "../gi.h"
#include "../gobject.h"
#include "../macros.h"
#include "../value.h"
#include "system.h"

using v8::Local;
using v8::Object;

namespace GNodeJS {

namespace System {


NAN_METHOD(AddressOf) {
    Local<Object> object = info[0].As<Object>();
    void *ptr = object->GetAlignedPointerFromInternalField (0);

    char* pointer_string = g_strdup_printf("%p", ptr);

    RETURN(UTF8(pointer_string));

    g_free(pointer_string);
}

NAN_METHOD(RefCount) {
    Local<Object> obj = info[0].As<Object>();
    GObject *gobject = GObjectFromWrapper (obj);

    RETURN(gobject->ref_count);
}

NAN_METHOD(InternalFieldCount) {
    Local<Object> obj = info[0].As<Object>();
    RETURN(obj->InternalFieldCount());
}

NAN_METHOD(Breakpoint) {
    G_BREAKPOINT ();
}

Local<Object> GetModule() {
    auto exports = Nan::New<Object>();

    Nan::Export(exports, "addressOf", AddressOf);
    Nan::Export(exports, "refCount", RefCount);
    Nan::Export(exports, "internalFieldCount", InternalFieldCount);
    Nan::Export(exports, "breakpoint", Breakpoint);

    return exports;
}


}; // System

}; // GnodeJS
