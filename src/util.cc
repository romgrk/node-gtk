/*
 * util.cc
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

#include "util.h"

using v8::Local;
using v8::Value;
using v8::Object;
using v8::String;

namespace Util {

const char* ArrayTypeToString (GIArrayType array_type) {
    switch (array_type) {
    case GI_ARRAY_TYPE_C:
        return "C-array";
    case GI_ARRAY_TYPE_ARRAY:
        return "GArray";
    case GI_ARRAY_TYPE_PTR_ARRAY:
        return "GPtrArray";
    case GI_ARRAY_TYPE_BYTE_ARRAY:
        return "GByteArray";
    }
    g_assert_not_reached();
}

void ThrowGError(const char* domain, GError* error) {
    char* message = g_strdup_printf("%s: %s", domain, error->message);
    Nan::ThrowError(message);
    g_free(message);
    g_error_free(error);
}

/**
 * This function is used to call "process._tickCallback()" inside NodeJS.
 * We want to do this after we run the LibUV eventloop because there might
 * be pending Micro-tasks from Promises or calls to 'process.nextTick()'.
 */
void CallNextTickCallback() {
    Local<Value> processValue = Nan::GetCurrentContext()->Global()->Get(
            Nan::New<String>("process").ToLocalChecked());
    if (processValue->IsObject()) {
        Local<Object> processObject = processValue->ToObject();
        Local<Value> tickCallbackValue = processObject->Get(Nan::New("_tickCallback").ToLocalChecked());
        if (tickCallbackValue->IsFunction()) {
            Nan::CallAsFunction(tickCallbackValue->ToObject(), processObject, 0, nullptr);
        }
    }
}

}
