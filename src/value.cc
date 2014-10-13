
#include "value.h"

namespace GINode {

v8::Handle<v8::Value> GIArgumentToV8(GITypeInfo *type_info, GIArgument *arg) {
    GITypeTag type_tag = g_type_info_get_tag (type_info);

    switch (type_tag) {
    case GI_TYPE_TAG_VOID:
        return v8::Undefined ();

    case GI_TYPE_TAG_BOOLEAN:
        if (arg->v_boolean)
            return v8::True ();
        else
            return v8::False ();

    case GI_TYPE_TAG_INT32:
        return v8::Integer::New (arg->v_int);
    case GI_TYPE_TAG_UINT32:
        return v8::Integer::NewFromUnsigned (arg->v_uint);
    case GI_TYPE_TAG_INT16:
        return v8::Integer::New (arg->v_int16);
    case GI_TYPE_TAG_UINT16:
        return v8::Integer::NewFromUnsigned (arg->v_uint16);
    case GI_TYPE_TAG_INT8:
        return v8::Integer::New (arg->v_int8);
    case GI_TYPE_TAG_UINT8:
        return v8::Integer::NewFromUnsigned (arg->v_uint8);
    case GI_TYPE_TAG_FLOAT:
        return v8::Number::New (arg->v_float);
    case GI_TYPE_TAG_DOUBLE:
        return v8::Number::New (arg->v_double);

    /* For 64-bit integer types, use a float. When JS and V8 adopt
     * bigger sized integer types, start using those instead. */
    case GI_TYPE_TAG_INT64:
        return v8::Number::New (arg->v_int64);
    case GI_TYPE_TAG_UINT64:
        return v8::Number::New (arg->v_uint64);

    case GI_TYPE_TAG_UNICHAR:
        {
            char data[7];
            int size = g_unichar_to_utf8 (arg->v_uint32, data);
            return v8::String::New (data, size);
        }

    case GI_TYPE_TAG_UTF8:
        if (arg->v_pointer)
            return v8::String::New ((char *) arg->v_pointer);
        else
            return v8::Null ();

    default:
        g_assert_not_reached ();
    }
}

};
