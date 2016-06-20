/*
 * argument.cc
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

#include "argument.h"

namespace NodeGtk {

gchar * GetArgumentDisplayName(const char *arg_name, ArgumentType arg_type) {
  switch (arg_type) {
  case ARGUMENT_ARGUMENT:
    return g_strdup_printf("Argument '%s'", arg_name);
  case ARGUMENT_RETURN_VALUE:
    return g_strdup("Return value");
  case ARGUMENT_FIELD:
    return g_strdup_printf("Field '%s'", arg_name);
  case ARGUMENT_LIST_ELEMENT:
    return g_strdup("List element");
  case ARGUMENT_HASH_ELEMENT:
    return g_strdup("Hash element");
  case ARGUMENT_ARRAY_ELEMENT:
    return g_strdup("Array element");
  }
  g_assert_not_reached ();
}

} /* NodeGtk */
