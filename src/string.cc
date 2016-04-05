/*
 * string.cc
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

#include "string.h"

#define REGEX(pattern, error) \
    g_regex_new( pattern, (GRegexCompileFlags)0, (GRegexMatchFlags)0, &error)

#define MATCH_FLAG    (GRegexMatchFlags)    0
#define MATCH_GLOBAL  (GRegexMatchFlags)    0
#define COMPILE_FLAG  (GRegexCompileFlags)  0


namespace NodeGtk {

    /*   some_func_name    ->     someSignalName
     */
    gchar * getCamelCaseName(const gchar *name) {
        GError *error = NULL;
        GRegex *regex = REGEX("([_\\W]+)([a-zA-Z0-9]+)", error);
        if (error) {
            g_print("Regex error: %s", error->message);
            g_assert_not_reached();
        }
        return g_regex_replace(regex, name, -1, 0, "\\u\\2", MATCH_FLAG, NULL);
    }

    /*   some_name    ->     SOME_NAME
    */
    gchar * getConstantName(const gchar *name) {
        GError *error = NULL;
        GRegex *regex = REGEX("(\\w+)[-\\W]+", error);
        if (error) {
            g_print("Regex error: %s", error->message);
            g_assert_not_reached();
        }
        return g_regex_replace(regex, name, -1, 0, "\\U\\1_", MATCH_FLAG, NULL);
    }
}


