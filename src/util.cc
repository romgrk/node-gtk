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

}

namespace GNodeJS {

G_DEFINE_QUARK(gnode_js_object,   object);
G_DEFINE_QUARK(gnode_js_template, template);

}
