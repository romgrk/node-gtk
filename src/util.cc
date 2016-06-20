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

static const GRegex *camel_regex = g_regex_new("([_\\W]+)([a-zA-Z0-9]+)", COMPILE_FLAG, MATCH_FLAG, NULL);

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

/* some_name -> someName */
char* ToCamelCase(const char *name) {
    return g_regex_replace(camel_regex, name, -1, 0, "\\u\\2", MATCH_FLAG, NULL);
}

}

namespace GNodeJS {

G_DEFINE_QUARK(gnode_js_object,   object);
G_DEFINE_QUARK(gnode_js_template, template);

}
