#include <string.h>

#include "type.h"

using v8::Array;
using v8::External;
using v8::Function;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::Persistent;
using v8::String;
using v8::Value;

namespace GNodeJS {

namespace Throw {

void GError(const char* domain, GError* error) {
    char* message = g_strdup_printf("%s: %s", domain, error->message);
    Nan::ThrowError(message);
    g_free(message);
    g_error_free(error);
}

void NotEnoughArguments (int expected, int actual) {
    char *msg = g_strdup_printf(
        "Not enough arguments; expected %i, have %i",
        expected, actual);
    Nan::ThrowTypeError(msg);
    g_free(msg);
}

void InvalidType (GIArgInfo *info, GITypeInfo *type_info, Local<Value> value) {
    char *expected = GetTypeName (type_info);
    char *msg = g_strdup_printf(
        "Expected argument of type %s for parameter %s, got '%s'",
        expected,
        g_base_info_get_name(info),
        *Nan::Utf8String(Nan::ToDetailString(value).ToLocalChecked()));
    Nan::ThrowTypeError(msg);
    g_free(expected);
    g_free(msg);
}

void InvalidReturnValue (GITypeInfo *type_info, Local<Value> value) {
    char *expected = GetTypeName (type_info);
    char *msg = g_strdup_printf(
        "Expected return value of type %s, got '%s'",
        expected,
        *Nan::Utf8String(Nan::ToDetailString(value).ToLocalChecked()));
    Nan::ThrowTypeError(msg);
    g_free(expected);
    g_free(msg);
}

void UnsupportedCallback (GIBaseInfo* info) {
    char* message = g_strdup_printf ("Function %s.%s has a GDestroyNotify but no user_data, not supported",
                g_base_info_get_namespace (info),
                g_base_info_get_name (info));
    Nan::ThrowError(message);
    g_free(message);
}

void InvalidGType (const char *category, GType gtype) {
    char* message = g_strdup_printf (
            "Value is not instance of %s %s",
            category,
            g_type_name (gtype));
    Nan::ThrowTypeError(message);
    g_free(message);
}

void GTypeNotFound (GIBaseInfo *info, const char* error) {
    char* message = g_strdup_printf (
            "Couldn't load %s.%s: %s",
            g_base_info_get_namespace(info),
            g_base_info_get_name(info),
            error);
    Nan::ThrowError(message);
    g_free(message);
}

}; // namespace Throw

}; // namespace GNodeJS
