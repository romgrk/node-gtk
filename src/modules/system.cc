
#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>
#include <glib-object.h>


#include "../gi.h"
#include "../boxed.h"
#include "../gobject.h"
#include "../macros.h"
#include "../type.h"
#include "../value.h"
#include "system.h"

using v8::Local;
using v8::Object;

namespace GNodeJS {

namespace System {

static gsize GetObjectSize (Local<Object> object) {
    // Boxed
    if (object->InternalFieldCount() == 2) {
        auto box = static_cast<Boxed*>(object->GetAlignedPointerFromInternalField(1));
        return GetComplexTypeSize(box->info);
    }
    // GObject
    else {
        GType gtype = GET_OBJECT_GTYPE(object);
        auto base_info = BaseInfo(g_irepository_find_by_gtype(NULL, gtype));
        return GetComplexTypeSize(*base_info);
    }
}


NAN_METHOD(AddressOf) {
    Local<Object> object = info[0].As<Object>();
    void *pointer = object->GetAlignedPointerFromInternalField (0);
    RETURN(Nan::New<Number>((uint64_t)pointer));
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

NAN_METHOD(GetSize) {
    RETURN(Nan::New<Number>((uint32_t) GetObjectSize(info[0].As<Object>())));
}

NAN_METHOD(ConvertGValue) {
    Local<Object> obj = info[0].As<Object>();
    if (!ValueHasInternalField(obj)) {
        RETURN(Nan::Undefined());
        return;
    }
    void *ptr = obj->GetAlignedPointerFromInternalField (0);
    bool mustCopy = true;
    RETURN(GValueToV8(reinterpret_cast<GValue *>(ptr), mustCopy));
}

NAN_METHOD(GetMemoryContent) {
    uint8_t *address;
    uint64_t size;

    if (info.Length() == 2) {
        address = (uint8_t *) Nan::To<int64_t>(info[0].As<Number>()).ToChecked();
        size    = Nan::To<int64_t>(info[1].As<Number>()).ToChecked();
    }
    else {
        auto object = info[0].As<Object>();
        address = (uint8_t *) object->GetAlignedPointerFromInternalField (0);
        size    = GetObjectSize(object);
    }

    auto result = Nan::New<v8::Array>(size);

    for (size_t i = 0; i < size; i++) {
        Nan::Set(result, i, Nan::New<v8::Uint32>(address[i]));
    }

    RETURN(result);
}

NAN_METHOD(Breakpoint) {
    G_BREAKPOINT ();
}

Local<Object> GetModule() {
    auto exports = Nan::New<Object>();

    Nan::Export(exports, "addressOf", AddressOf);
    Nan::Export(exports, "refCount", RefCount);
    Nan::Export(exports, "internalFieldCount", InternalFieldCount);
    Nan::Export(exports, "getSize", GetSize);
    Nan::Export(exports, "getMemoryContent", GetMemoryContent);
    Nan::Export(exports, "breakpoint", Breakpoint);
    Nan::Export(exports, "convertGValue", ConvertGValue);

    return exports;
}


}; // System

}; // GnodeJS
