
#pragma once

#include <node.h>
#include <girepository.h>

#define UTF8(s) String::NewFromUtf8 (isolate, s)
#define FUNC(f) FunctionTemplate::New (isolate, f)->GetFunction ()
#define EXPORT(name,value) exports->Set (String::NewFromUtf8 (isolate, name), value)

#define THROW(error,...) \
        isolate->ThrowException ( error (String::NewFromUtf8 (isolate, g_strdup_printf(__VA_ARGS__))));

#define THROW_E(error, expr) \
        isolate->ThrowException ( error (String::NewFromUtf8 (isolate, expr->message )));
