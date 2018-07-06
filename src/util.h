/*
 * util.h
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

#pragma once

#include <node.h>
#include <girepository.h>

namespace Util
{
    const char*             ArrayTypeToString (GIArrayType array_type);
    void                    ThrowGError (const char* domain, GError* error);
} /* Util */

namespace GNodeJS {

GQuark object_quark (void) ;
GQuark template_quark (void) ;

}
