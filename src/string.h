/*
 * string.h
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the JSON initial license.
 */

#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <string.h>

#include "gi.h"

//struct _String {
    //enum {
        //V8_STRING, C_STRING, G_STRING, STD_STRING
    //} type;
    //void *      pointer;
//};
//typedef _String* String;

namespace NodeGtk {
    gchar *      GetCamelCaseName (const char *name);
}

