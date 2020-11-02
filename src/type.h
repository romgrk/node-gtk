/*
 * type.h
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::Value;

namespace GNodeJS {

char *    GetInfoName (GIBaseInfo* info);
char *    GetTypeName    (GITypeInfo *type_info);
gsize     GetTypeSize    (GITypeInfo *type_info);
gsize     GetComplexTypeSize (GIBaseInfo *info);
gsize     GetTypeTagSize (GITypeTag type_tag);
GITypeTag GetStorageType (GITypeInfo *type_info);
bool      IsTypeSimple (GITypeInfo *type_info);

};

