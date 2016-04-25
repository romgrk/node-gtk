/*
 * util.h
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

#pragma once

#include <node.h>
#include <girepository.h>

#define MATCH_FLAG    (GRegexMatchFlags)    0
#define COMPILE_FLAG  (GRegexCompileFlags)  0
#define REGEX(pattern, error) \
    g_regex_new( pattern, (GRegexCompileFlags)0, (GRegexMatchFlags)0, &error)

namespace Util
{
    const char*             arrayTypeToString (GIArrayType array_type) ;
    char*                   toCamelCase (const char *name) ;
} /* Util */

namespace GNodeJS {

GQuark object_quark (void) ;
GQuark template_quark (void) ;

}
