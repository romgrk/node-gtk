/*
 * argument.h
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

#pragma once

#include <nan.h>
#include <node.h>
#include <glib.h>
#include <girepository.h>

#include "gi.h"
#include "value.h"

namespace NodeGtk {

  /* Different roles for a GIArgument */
  typedef enum {
    ARGUMENT_ARGUMENT,
    ARGUMENT_RETURN_VALUE,
    ARGUMENT_FIELD,
    ARGUMENT_LIST_ELEMENT,
    ARGUMENT_HASH_ELEMENT,
    ARGUMENT_ARRAY_ELEMENT
  } ArgumentType;

  gchar * GetArgumentDisplayName(const char *arg_name, ArgumentType arg_type);

}
