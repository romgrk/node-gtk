
//#include <node.h>
//#include <nan.h>
#include <glib.h>

#include "boxed.h"
#include "function.h"
#include "gi.h"
#include "gobject.h"
#include "type.h"
#include "util.h"
#include "value.h"

#include "debug.h"

using v8::Array;
using v8::Boolean;
using v8::Integer;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;
using Nan::New;

namespace GNodeJS {

Local<Value> GIArgumentToV8(GITypeInfo *type_info, GIArgument *arg, int length) {
    GITypeTag type_tag = g_type_info_get_tag (type_info);

    switch (type_tag) {
    case GI_TYPE_TAG_VOID:
        return Nan::Undefined ();
    case GI_TYPE_TAG_BOOLEAN:
        return New<Boolean>((bool)arg->v_boolean);
    case GI_TYPE_TAG_INT32:
        return New<v8::Int32> (arg->v_int);
    case GI_TYPE_TAG_UINT32:
        return New<v8::Uint32> (arg->v_uint);
    case GI_TYPE_TAG_INT16:
        return New<v8::Int32> (arg->v_int16);
    case GI_TYPE_TAG_UINT16:
        return New<v8::Uint32> (arg->v_uint16);
    case GI_TYPE_TAG_INT8:
        return New<v8::Int32> (arg->v_int8);
    case GI_TYPE_TAG_UINT8:
        return New<v8::Uint32> (arg->v_uint8);
    case GI_TYPE_TAG_FLOAT:
        return New<Number> (arg->v_float);
    case GI_TYPE_TAG_DOUBLE:
        return New<Number> (arg->v_double);

    /* For 64-bit integer types, use a float. When JS and V8 adopt
     * bigger sized integer types, start using those instead. */
    case GI_TYPE_TAG_INT64:
        return New<Number> (arg->v_int64);
    case GI_TYPE_TAG_UINT64:
        return New<Number> (arg->v_uint64);

    case GI_TYPE_TAG_GTYPE: /* c++: gulong */
        return New<Number>((double)arg->v_ulong);

    case GI_TYPE_TAG_UNICHAR:
        {
            char data[7] = { 0 };
            g_unichar_to_utf8 (arg->v_uint32, data);
            return New<String>(data).ToLocalChecked();
        }

    case GI_TYPE_TAG_FILENAME:
        {
            gsize b_read = 0,
                  b_written = 0;
            GError *error = NULL;
            char *data = g_filename_to_utf8((const char *)arg->v_pointer, -1,
                    &b_read, &b_written, &error);
            if (error) {
                Nan::ThrowError(error->message);
                g_error_free(error);
                return Nan::Null();
            }
            auto str = New<String>(data).ToLocalChecked();
            g_free(data);
            return str;
        }

    case GI_TYPE_TAG_UTF8:
        if (arg->v_string)
            return New<String>(arg->v_string).ToLocalChecked();
        else
            return Nan::EmptyString();

    case GI_TYPE_TAG_INTERFACE:
        {
            GIBaseInfo *interface_info = g_type_info_get_interface (type_info);
            GIInfoType interface_type = g_base_info_get_type (interface_info);
            Local<Value> value;

            switch (interface_type) {
            /** from documentation:
             * GIObjectInfo represents a GObject. This doesn't represent a specific instance
             * of a GObject, instead this represent the object type (eg class).  A GObject
             * has methods, fields, properties, signals, interfaces, constants and virtual functions. */
            case GI_INFO_TYPE_OBJECT:
                value = WrapperFromGObject((GObject *)arg->v_pointer);
                break;
            case GI_INFO_TYPE_BOXED:
            case GI_INFO_TYPE_STRUCT:
            case GI_INFO_TYPE_UNION:
                value = WrapperFromBoxed (interface_info, arg->v_pointer);
                break;
            case GI_INFO_TYPE_ENUM:
            case GI_INFO_TYPE_FLAGS:
                value = New<Number>(arg->v_long);
                break;
            default:
                g_assert_not_reached ();
            }

            g_base_info_unref(interface_info);
            return value;
        }

    case GI_TYPE_TAG_ARRAY:
        return ArrayToV8(type_info, arg->v_pointer, length);

    case GI_TYPE_TAG_GLIST:
        return GListToV8(type_info, (GList *)arg->v_pointer);

    case GI_TYPE_TAG_GSLIST:
        return GSListToV8(type_info, (GSList *)arg->v_pointer);

    default:
        DEBUG("Tag: %s", g_type_tag_to_string(type_tag));
        g_assert_not_reached ();
    }
}

Local<Value> GListToV8 (GITypeInfo *info, GList *glist) {
    GITypeInfo *param_info = g_type_info_get_param_type(info, 0);

    g_assert(param_info != NULL);

    GIArgument arg;
    Local<Array> array = New<Array>();

    int i = 0;
    for (; glist != NULL; glist = glist->next) {
        arg.v_pointer = glist->data;
        Nan::Set(array, i, GIArgumentToV8(param_info, &arg));
        i++;
    }

    g_base_info_unref(param_info);
    return array;
}

Local<Value> GSListToV8 (GITypeInfo *info, GSList *list) {
    GITypeInfo *param_info = g_type_info_get_param_type(info, 0);
    g_assert(param_info != NULL);

    Local<Array> array = New<Array>();

    GIArgument arg;
    int i = 0;
    for (; list != NULL; list = list->next) {
        arg.v_pointer = list->data;
        Nan::Set(array, i, GIArgumentToV8(param_info, &arg));
        i++;
    }

    g_base_info_unref(param_info);
    return array;
}

Local<Value> ArrayToV8 (GITypeInfo *type_info, void* data, int length) {

    auto array = New<Array>();

    if (data == nullptr || length == 0)
        return array;

    auto array_type = g_type_info_get_array_type (type_info);
    auto* elem_type_info = g_type_info_get_param_type (type_info, 0);
    auto  elem_size = GetTypeSize (elem_type_info);
    auto is_zero_terminated = g_type_info_is_zero_terminated (type_info);

    GIArgument value;

    switch (array_type) {
        case GI_ARRAY_TYPE_C:
            {
                if (is_zero_terminated) {
                    length = g_strv_length ((gchar **)data);
                    //DEBUG("(zero) length: %i", length);
                    //DEBUG("(zero) elem-size: %li", elem_size);
                } else {
                    length = g_type_info_get_array_fixed_size (type_info);
                    //DEBUG("(non-zero) length: %i", length);
                    if (G_UNLIKELY (length == -1)) {
                        g_critical ("Unable to determine array length for %p",
                                data);
                        length = 0;
                        break;
                    }
                }
                g_assert (length >= 0);
                break;
            }
        case GI_ARRAY_TYPE_ARRAY:
        case GI_ARRAY_TYPE_BYTE_ARRAY:
            {
                /* Note: GByteArray is really just a GArray */
                GArray *g_array = (GArray*) data;
                data = g_array->data;
                length = g_array->len;
                //DEBUG("(g(byte)array) length: %i", length);
                break;
            }
        case GI_ARRAY_TYPE_PTR_ARRAY:
            {
                GPtrArray *ptr_array = (GPtrArray*) data;
                data = ptr_array->pdata;
                length = ptr_array->len;
                //DEBUG("(gptrarray) length: %i", length);
                elem_size = sizeof(gpointer);
                break;
            }
        default:
            g_critical ("Unexpected array type %u",
                    g_type_info_get_array_type (type_info));
            break;
    }

    if (data == nullptr || length == 0)
        goto out;

    if (is_zero_terminated) {
        char** val = (char **)data;
        for (int i = 0; i < length && (val[0] != NULL); i++) {
            value.v_pointer = val[0];
            Nan::Set(array, i, GIArgumentToV8(elem_type_info, &value));
            val += elem_size / 8;
        }
    } else {
        for (int i = 0; i < length; i++) {
            value.v_pointer = (char *)data + ((elem_size/8) * i);
            Nan::Set(array, i, GIArgumentToV8(elem_type_info, &value));
        }
    }

out:
    g_base_info_unref(elem_type_info);
    return array;
}

GArray * V8ToGArray(GITypeInfo *type_info, Local<Value> value) {
    GArray* g_array = NULL;
    bool zero_terminated = g_type_info_is_zero_terminated(type_info);

    if (value->IsString()) {
        Local<String> string = value->ToString();
        int length = string->Length();

        if (length == 0)
            return g_array_new(zero_terminated, TRUE, sizeof(char));

        const char *utf8_data = *String::Utf8Value(string);
        g_array = g_array_sized_new (zero_terminated, FALSE, sizeof (char), length);
        return g_array_append_vals(g_array, utf8_data, length);

    } else if (value->IsArray ()) {
        auto array = Local<Array>::Cast (value->ToObject ());
        int length = array->Length ();

        GITypeInfo* elem_info = g_type_info_get_param_type (type_info, 0);
        gsize elem_size = GetTypeSize(elem_info);

        // FIXME this is so wrong
        g_array = g_array_sized_new (zero_terminated, FALSE, elem_size, length);

        for (int i = 0; i < length; i++) {
            auto value = array->Get(i);
            GIArgument arg;

            if (V8ToGIArgument(elem_info, &arg, value, true)) {
                g_array_append_val (g_array, arg);
            } else {
                g_warning("V8ToGArray: couldnt convert value: %s",
                        *String::Utf8Value(value->ToString()) );
            }
        }

        g_base_info_unref (elem_info);
    } else {
        Nan::ThrowTypeError("Not an array.");
    }

    return g_array;
}

/**
 * V8ToGList:
 *
 * Returns: #GList or #GSList
 */
gpointer V8ToGList (Local<Value> value, GITypeInfo *type_info) {

    // FIXME can @value be null?
    if (!value->IsArray()) {
        Nan::ThrowTypeError("Invalid conversion from value to GList");
        return NULL;
    }

    Local<Array> array = Local<Array>::Cast(value->ToObject ());
    int length = array->Length();

    if (length == 0)
        return NULL; // NULL is a valid empty GList

    GITypeTag   list_type = g_type_info_get_tag(type_info);
    GITypeInfo *elem_info = g_type_info_get_param_type(type_info, 0);

    g_assert(elem_info != NULL);

    void *list;
    if (list_type == GI_TYPE_TAG_GLIST)
        list = NULL;
    else if (list_type == GI_TYPE_TAG_GSLIST)
        list = NULL;
    else
        g_assert_not_reached();

    for (int i = 0; i < length; i++) {
        GIArgument arg;
        Local<Value> value = array->Get(i);

        if (!V8ToGIArgument(elem_info, &arg, value, false)) {
            g_warning("V8ToGList: couldnt convert value #%i to GIArgument", i);
            continue;
        }

        if (list_type == GI_TYPE_TAG_GLIST)
            list = g_list_prepend((GList *)list, arg.v_pointer);
        else
            list = g_slist_prepend((GSList *)list, arg.v_pointer);

        // XXX free GIArgument?
    }

    if (list_type == GI_TYPE_TAG_GLIST)
        list = g_list_reverse((GList *)list);
    else
        list = g_slist_reverse((GSList *)list);

    g_base_info_unref(elem_info);
    return list;
}

bool V8ToGIArgument(GITypeInfo *type_info, GIArgument *arg, Local<Value> value) {
    GIInfoType type = g_base_info_get_type (type_info);

    switch (type) {
    case GI_INFO_TYPE_OBJECT:
        arg->v_pointer = GObjectFromWrapper(value); // XXX Wrong?
        break;
    case GI_INFO_TYPE_BOXED:
    case GI_INFO_TYPE_STRUCT:
    case GI_INFO_TYPE_UNION:
        arg->v_pointer = BoxedFromWrapper(value);
        break;
    case GI_INFO_TYPE_FLAGS:
    case GI_INFO_TYPE_ENUM:
        arg->v_int = value->Int32Value ();
        break;
    case GI_INFO_TYPE_INTERFACE:
    default:
        print_info (type_info);
        g_assert_not_reached ();
    }
    return true;
}

bool V8ToGIArgument(GITypeInfo *type_info, GIArgument *arg, Local<Value> value, bool may_be_null) {
    GITypeTag type_tag = g_type_info_get_tag (type_info);

    if (value->IsUndefined () || value->IsNull ()) {
        arg->v_pointer = NULL;
        if (!may_be_null) {
            Nan::ThrowTypeError("Trying to convert null/undefined value to GIArgument.");
            return false;
        }
        return true;
    }

    switch (type_tag) {
    case GI_TYPE_TAG_VOID:
        arg->v_pointer = NULL;
        break;
    case GI_TYPE_TAG_BOOLEAN:
        arg->v_boolean = value->BooleanValue ();
        break;
    case GI_TYPE_TAG_INT32:
        arg->v_int = value->Int32Value ();
        break;
    case GI_TYPE_TAG_UINT32:
        arg->v_uint = value->Uint32Value ();
        break;
    case GI_TYPE_TAG_INT64:
        arg->v_int64 = value->NumberValue ();
        break;
    case GI_TYPE_TAG_UINT64:
        arg->v_uint64 = value->NumberValue ();
        break;
    case GI_TYPE_TAG_FLOAT:
        arg->v_float = value->NumberValue ();
        break;
    case GI_TYPE_TAG_DOUBLE:
        arg->v_double = value->NumberValue ();
        break;
    case GI_TYPE_TAG_GTYPE:
        arg->v_ulong = value->NumberValue ();
        break;

    case GI_TYPE_TAG_UTF8:
        {
            String::Utf8Value str (value);
            const char *data = *str;
            arg->v_pointer = g_strdup (data);
        }
        break;

    case GI_TYPE_TAG_FILENAME:
        {
            String::Utf8Value str (value);
            const char *utf8_data = *str;
            arg->v_pointer = g_filename_from_utf8 (utf8_data, -1, NULL, NULL, NULL);
        }
        break;

    case GI_TYPE_TAG_ARRAY:
        {
            GIArrayType array_type = g_type_info_get_array_type (type_info);
            GArray *garray = V8ToGArray(type_info, value);

            switch (array_type) {
            case GI_ARRAY_TYPE_C:
                arg->v_pointer = g_array_free (garray, FALSE);
                break;
            case GI_ARRAY_TYPE_ARRAY:
            case GI_ARRAY_TYPE_BYTE_ARRAY:
                arg->v_pointer = garray;
                break;
            //case GI_ARRAY_TYPE_PTR_ARRAY:
            default:
                printf("%s", Util::ArrayTypeToString(array_type));
                g_assert_not_reached ();
            }
        }
        break;

    case GI_TYPE_TAG_INTERFACE:
        {
            GIBaseInfo *interface_info = g_type_info_get_interface (type_info);
            V8ToGIArgument (interface_info, arg, value);
            g_base_info_unref(interface_info);
        }
        break;

    case GI_TYPE_TAG_GLIST:
    case GI_TYPE_TAG_GSLIST:
        arg->v_pointer = V8ToGList(value, type_info);
        break;

    //case GI_TYPE_TAG_GHASH: FIXME
    //case GI_TYPE_TAG_ERROR: FIXME

    case GI_TYPE_TAG_UNICHAR: // FIXME
        arg->v_uint32 = value->Int32Value();
        break;

    default:
        g_assert_not_reached ();
    }

    return true;
}

void FreeGIArgument(GITypeInfo *type_info, GIArgument *arg, GITransfer transfer) {
    GITypeTag type_tag = g_type_info_get_tag (type_info);

    if (G_TYPE_TAG_IS_BASIC(type_tag))
        return;

    if (transfer == GI_TRANSFER_NOTHING) {
        g_warning("FreeArg: transfer == nothing");
        return;
    }


    // TODO determine in which cases the argument is to be freed
    switch (type_tag) {
    case GI_TYPE_TAG_FILENAME:
    case GI_TYPE_TAG_UTF8:
        g_free (arg->v_pointer);
        break;

    case GI_TYPE_TAG_ARRAY:
        {
            GIArrayType array_type = g_type_info_get_array_type (type_info);
            gboolean free_data = (transfer == GI_TRANSFER_EVERYTHING);

            switch (array_type) {
            case GI_ARRAY_TYPE_C: {
                if (free_data)
                    g_strfreev ((char **)arg->v_pointer);
                else
                    g_free (arg->v_pointer);
                return;
            }
            // FIXME really free elements for these too
            case GI_ARRAY_TYPE_ARRAY:
                g_array_free ((GArray *) arg->v_pointer, free_data);
                break;
            case GI_ARRAY_TYPE_PTR_ARRAY:
                g_ptr_array_free ((GPtrArray *) arg->v_pointer, free_data);
                break;
            case GI_ARRAY_TYPE_BYTE_ARRAY:
                g_byte_array_free ((GByteArray *) arg->v_pointer, free_data);
                break;
            default:
                g_assert_not_reached ();
            }
            g_warning("%s freed; whatsup with elements?",
                    Util::ArrayTypeToString(array_type));
        }
        break;

    case GI_TYPE_TAG_GLIST: {
        if (transfer == GI_TRANSFER_EVERYTHING)
            g_warning("FreeArgument: unhandled GList");
        g_list_free((GList *)arg->v_pointer);
        break;
    }
    case GI_TYPE_TAG_GSLIST: {
        if (transfer == GI_TRANSFER_EVERYTHING)
            g_warning("FreeArgument: unhandled GSList");
        g_slist_free((GSList *)arg->v_pointer);
        break;
    }

    // FIXME FIXME FIXME
    case GI_TYPE_TAG_INTERFACE: // an extended interface object
    {
        GIBaseInfo *i_info = g_type_info_get_interface(type_info);
        GIInfoType  i_type = g_base_info_get_type(i_info);
        switch (i_type) {
        case GI_INFO_TYPE_OBJECT:
            // if (transfer == GI_TRANSFER_EVERYTHING)
                // g_object_unref(G_OBJECT(arg->v_pointer));
            //g_warning("FreeArgument: unhandled GObject %s",
                    //g_base_info_get_name(i_info));
            break;
        case GI_INFO_TYPE_BOXED:
        case GI_INFO_TYPE_STRUCT:
        case GI_INFO_TYPE_UNION:
        {
            //GType gtype = g_registered_type_info_get_g_type(i_info);
            //g_boxed_free(gtype, arg->v_pointer);
            //g_warning("FreeArgument: unhandled boxed %s",
                    //g_base_info_get_name(i_info));
            break;
        }
        case GI_INFO_TYPE_ENUM:
        case GI_INFO_TYPE_FLAGS: // Nothing to do (~int32 values)
            break;

        default:
            g_warning("FreeArgument: unhandled (?) %s",
                    g_base_info_get_name(i_info));
            break;
        }
        g_base_info_unref(i_info);
        break;
    }

    case GI_TYPE_TAG_GHASH:
        //g_hash_table_destroy((GHashTable *)arg->v_pointer);
        g_warning("FreeGIArgument: unhandled GHash");
        break;

    case GI_TYPE_TAG_ERROR:
        g_warning("FreeGIArgument: GError (wtf); msg: %s",
                ((GError *)arg->v_pointer)->message );
        //g_error_free((GError *)arg->v_pointer);
        break;

    default:
        g_warning("FreeGIArgument: reached default for type %s \n",
                g_type_tag_to_string(type_tag));
        break;
    }
}

void V8ToGValue(GValue *gvalue, Local<Value> value) {
    if (G_VALUE_HOLDS_BOOLEAN (gvalue)) {
        g_value_set_boolean (gvalue, value->BooleanValue ());
    } else if (G_VALUE_HOLDS_INT (gvalue)) {
        g_value_set_int (gvalue, value->Int32Value ());
    } else if (G_VALUE_HOLDS_UINT (gvalue)) {
        g_value_set_uint (gvalue, value->Uint32Value ());
    } else if (G_VALUE_HOLDS_FLOAT (gvalue)) {
        g_value_set_float (gvalue, value->NumberValue ());
    } else if (G_VALUE_HOLDS_DOUBLE (gvalue)) {
        g_value_set_double (gvalue, value->NumberValue ());
    } else if (G_VALUE_HOLDS_GTYPE (gvalue)) {
        GType type;
        if (value->IsString())
            type = g_type_from_name(*String::Utf8Value(value));
        else
            type = value->NumberValue ();
        g_value_set_gtype(gvalue, type);
    } else if (G_VALUE_HOLDS_STRING (gvalue)) {
        String::Utf8Value str (value);
        const char *data = *str;
        g_value_set_string (gvalue, data);
    } else if (G_VALUE_HOLDS_ENUM (gvalue)) {
        g_value_set_enum (gvalue, value->Int32Value ());
    } else if (G_VALUE_HOLDS_OBJECT (gvalue)) {
        g_value_set_object (gvalue, GObjectFromWrapper (value));
    } else {
        g_assert_not_reached ();
    }
}

Local<Value> GValueToV8(const GValue *gvalue) {
    if (G_VALUE_HOLDS_BOOLEAN (gvalue)) {
        if (g_value_get_boolean (gvalue))
            return New<Boolean>(true);
        else
            return New<Boolean>(false);
    } else if (G_VALUE_HOLDS_INT (gvalue)) {
        return New<Integer>(g_value_get_int (gvalue));
    } else if (G_VALUE_HOLDS_UINT (gvalue)) {
        return New<v8::Uint32>(g_value_get_uint (gvalue));
    } else if (G_VALUE_HOLDS_FLOAT (gvalue)) {
        return New<Number>(g_value_get_float (gvalue));
    } else if (G_VALUE_HOLDS_DOUBLE (gvalue)) {
        return New<Number>(g_value_get_double (gvalue));
    } else if (G_VALUE_HOLDS_STRING (gvalue)) {
        auto str = g_value_get_string (gvalue);
        if (str)
            return New<String>(str).ToLocalChecked();
        else
            return Nan::EmptyString();
    } else if (G_VALUE_HOLDS_ENUM (gvalue)) {
        return New<Integer>(g_value_get_enum (gvalue));
    } else if (G_VALUE_HOLDS_OBJECT (gvalue)) {
        return WrapperFromGObject (G_OBJECT (g_value_get_object (gvalue)));
    } else if (G_VALUE_HOLDS_BOXED (gvalue)) {
        GType type = G_VALUE_TYPE (gvalue);
        g_type_ensure(type);
        GIBaseInfo *info = g_irepository_find_by_gtype(NULL, type);
        Local<Value> obj = WrapperFromBoxed(info, g_value_get_boxed(gvalue));
        g_base_info_unref(info);
        return obj;
    } else {
        g_assert_not_reached ();
    }
}

};
