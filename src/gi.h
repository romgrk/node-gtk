
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>

#define UTF8(s)         String::NewFromUtf8 (isolate, s)

#define UTF8_NAME(s)    String::NewFromUtf8 (isolate, g_base_info_get_name(s))

#define THROW(error,...)                    \
        isolate->ThrowException ( error (   \
                v8::String::NewFromUtf8 (isolate, g_strdup_printf(__VA_ARGS__))));

#define THROW_E(error, expr)                \
        isolate->ThrowException ( error (   \
        v8::String::NewFromUtf8 (isolate, expr->message )));
