
#pragma once

#include "value.h"
#include <nan.h>
#include <node.h>
#include <girepository.h>

using v8::External;
using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;

namespace GNodeJS {

class Boxed {
public:
    void* data;
    GType gtype;
    GIBaseInfo * info;
    unsigned long size;
    bool owns_memory;
    Nan::Persistent<Object> *persistent;

    static size_t GetSize (GIBaseInfo *boxed_info) ;
};

// Allocate zero-filled backing memory for a boxed/struct instance. Registered
// boxed types are freed with g_boxed_free (which, by GLib convention, uses
// g_slice_free), so they must be allocated with g_slice — allocating them with
// g_malloc0 and freeing with g_slice_free corrupts the slice allocator on
// GLib builds where GSlice is a real slab allocator (#290, #213).
gpointer                AllocateBoxed    (GType gtype, size_t size);

Local<Function>         MakeBoxedClass   (GIBaseInfo *info);
Local<FunctionTemplate> GetBoxedTemplate (GIBaseInfo *info, GType gtype);
Local<Value>            WrapperFromBoxed (GIBaseInfo *info, void *data, ResourceOwnership ownership = kNone);
void *                  PointerFromWrapper (Local<Value>);

};
