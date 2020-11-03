
//#include <node.h>
//#include <nan.h>
#include <glib.h>
#include <glib-object.h>

#include "error.h"
#include "boxed.h"
#include "function.h"
#include "gi.h"
#include "gobject.h"
#include "macros.h"
#include "param_spec.h"
#include "type.h"
#include "util.h"
#include "value.h"

#include "debug.h"

using v8::Array;
using v8::TypedArray;
using v8::Integer;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Value;
using Nan::New;

namespace GNodeJS {

static gpointer GIArgumentToHashPointer (const GIArgument *arg, GITypeInfo *type_info);

static void HashPointerToGIArgument (GIArgument *arg, GITypeInfo *type_info);

static bool IsUint8Array (GITypeInfo *type_info);


Local<Value> GIArgumentToV8(GITypeInfo *type_info, GIArgument *arg, long length, bool mustCopy) {
    GITypeTag type_tag = g_type_info_get_tag (type_info);

    switch (type_tag) {
    case GI_TYPE_TAG_VOID:
        return Nan::Undefined ();
    case GI_TYPE_TAG_BOOLEAN:
        return New<v8::Boolean>((bool)arg->v_boolean);
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
            if (arg->v_pointer == NULL)
                return Nan::Null();

            gsize b_read    = 0;
            gsize b_written = 0;
            GError *error = NULL;

            char *data = g_filename_to_utf8(
                    (const char *)arg->v_pointer, -1, &b_read, &b_written, &error);

            if (error) {
                Nan::ThrowError(error->message);
                g_error_free(error);
                return Nan::Null();
            }

            auto str = New<String>(data).ToLocalChecked();
            g_free(data);
            return str;
        }

    case GI_TYPE_TAG_UTF8: {
        if (arg->v_string)
            return New<String>(arg->v_string).ToLocalChecked();
        else
            return Nan::EmptyString();
    }

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
                if (G_IS_PARAM_SPEC(arg->v_pointer))
                    value = ParamSpec::FromGParamSpec((GParamSpec *)arg->v_pointer);
                else
                    value = WrapperFromGObject((GObject *)arg->v_pointer);
                break;
            case GI_INFO_TYPE_BOXED:
            case GI_INFO_TYPE_STRUCT:
            case GI_INFO_TYPE_UNION:
                value = WrapperFromBoxed (interface_info, arg->v_pointer, mustCopy);
                break;
            case GI_INFO_TYPE_ENUM:
                value = New<Number>(arg->v_int);
                break;
            case GI_INFO_TYPE_FLAGS:
                value = New<Number>(arg->v_uint);
                break;
            case GI_INFO_TYPE_INTERFACE: {
                value = WrapperFromGObject((GObject *)arg->v_pointer);
                break;
            }
            default:
                print_info (interface_info);
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

    case GI_TYPE_TAG_GHASH:
        return GHashToV8(type_info, (GHashTable *)arg->v_pointer);

    case GI_TYPE_TAG_ERROR:
        return GErrorToV8(type_info, (GError *)arg->v_pointer);

    default:
        g_critical("Tag: %s", g_type_tag_to_string(type_tag));
        g_assert_not_reached ();
    }
}

Local<Value> GListToV8 (GITypeInfo *type_info, GList *glist) {
    GITypeInfo *param_info = g_type_info_get_param_type(type_info, 0);

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

Local<Value> GSListToV8 (GITypeInfo *type_info, GSList *list) {
    GITypeInfo *param_info = g_type_info_get_param_type(type_info, 0);
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

Local<Value> GHashToV8 (GITypeInfo *type_info, GHashTable *hash_table) {
    GITypeInfo *key_info   = g_type_info_get_param_type (type_info, 0);
    GITypeInfo *value_info = g_type_info_get_param_type (type_info, 1);

    Local<Object> object = New<Object>();

    GHashTableIter iter;
    GIArgument key_arg;
    GIArgument value_arg;
    g_hash_table_iter_init (&iter, hash_table);
    while (g_hash_table_iter_next (&iter, &key_arg.v_pointer, &value_arg.v_pointer))
    {
        HashPointerToGIArgument(&value_arg, value_info);

        auto key   = GIArgumentToV8(key_info, &key_arg);
        auto value = GIArgumentToV8(value_info, &value_arg);

        Nan::Set(object, key, value);
    }

    g_base_info_unref(key_info);
    g_base_info_unref(value_info);

    return object;
}

Local<Value> GErrorToV8 (GITypeInfo *type_info, GError *err) {
    auto err_info = g_irepository_find_by_name(NULL, "GLib", "Error");
    auto obj = WrapperFromBoxed (err_info, err, true);
    return obj;
}

Local<Value> ArrayToV8 (GITypeInfo *type_info, void* data, long length) {

    auto array = New<Array>();

    if (data == nullptr || length == 0)
        return array;

    auto array_type = g_type_info_get_array_type (type_info);
    auto item_type_info = g_type_info_get_param_type (type_info, 0);
    auto item_size = GetTypeSize (item_type_info);
    // auto item_transfer = transfer == GI_TRANSFER_CONTAINER ? GI_TRANSFER_NOTHING : transfer;

    switch (array_type) {
        case GI_ARRAY_TYPE_C:
            {
                if (length == -1) {
                    if (g_type_info_is_zero_terminated (type_info)) {
                        length = g_strv_length ((gchar **)data);
                    }
                    else {
                        length = g_type_info_get_array_fixed_size (type_info);
                        if (G_UNLIKELY (length == -1)) {
                            g_critical ("Unable to determine array length for %p", data);
                            length = 0;
                            break;
                        }
                    }
                }
                g_assert (length >= 0);
                break;
            }
        case GI_ARRAY_TYPE_ARRAY:
        case GI_ARRAY_TYPE_BYTE_ARRAY:
            {
                GArray *g_array = (GArray*) data;
                data   = g_array->data;
                length = g_array->len;
                item_size = g_array_get_element_size (g_array);
                break;
            }
        case GI_ARRAY_TYPE_PTR_ARRAY:
            {
                GPtrArray *ptr_array = (GPtrArray*) data;
                data   = ptr_array->pdata;
                length = ptr_array->len;
                item_size = sizeof(gpointer);
                break;
            }
        default:
            g_assert_not_reached();
            break;
    }

    if (data == nullptr || length == 0)
        goto out;


    /*
     * Fill array elements
     */

    GIArgument value;

    for (int i = 0; i < length; i++) {
        void** pointer = (void**)((ulong)data + i * item_size);
        memcpy(&value, pointer, item_size);
        Nan::Set(array, i, GIArgumentToV8(item_type_info, &value));
    }


out:
    g_base_info_unref(item_type_info);
    return array;
}

long GIArgumentToLength(GITypeInfo *type_info, GIArgument *arg, bool is_pointer) {
    GITypeTag type_tag = g_type_info_get_tag (type_info);

    switch (type_tag) {
    case GI_TYPE_TAG_INT8:
        return is_pointer ? *(gint8*)arg->v_pointer : arg->v_int8;
    case GI_TYPE_TAG_UINT8:
        return is_pointer ? *(guint8*)arg->v_pointer : arg->v_uint8;
    case GI_TYPE_TAG_INT16:
        return is_pointer ? *(gint16*)arg->v_pointer : arg->v_int16;
    case GI_TYPE_TAG_UINT16:
        return is_pointer ? *(guint16*)arg->v_pointer : arg->v_uint16;
    case GI_TYPE_TAG_INT32:
        return is_pointer ? *(gint*)arg->v_pointer : arg->v_int;
    case GI_TYPE_TAG_UNICHAR:
    case GI_TYPE_TAG_UINT32:
        return is_pointer ? *(guint*)arg->v_pointer : arg->v_uint;
    case GI_TYPE_TAG_INT64:
        return is_pointer ? *(guint64*)arg->v_pointer : arg->v_uint64;
    case GI_TYPE_TAG_UINT64:
        return is_pointer ? *(guint64*)arg->v_pointer : arg->v_uint64;

    case GI_TYPE_TAG_VOID:
    case GI_TYPE_TAG_BOOLEAN:
    case GI_TYPE_TAG_FLOAT:
    case GI_TYPE_TAG_DOUBLE:
    case GI_TYPE_TAG_GTYPE:
    case GI_TYPE_TAG_FILENAME:
    case GI_TYPE_TAG_UTF8:
    case GI_TYPE_TAG_INTERFACE:
    case GI_TYPE_TAG_ARRAY:
    case GI_TYPE_TAG_GLIST:
    case GI_TYPE_TAG_GSLIST:
    case GI_TYPE_TAG_GHASH:
    case GI_TYPE_TAG_ERROR:
    default:
        ERROR("Cannot convert tag %s to length", g_type_tag_to_string(type_tag));
    }
}


GArray * V8ToGArray(GITypeInfo *type_info, Local<Value> value) {
    GArray* g_array = NULL;
    bool zero_terminated = g_type_info_is_zero_terminated(type_info);

    if (value->IsString()) {
        Local<String> string = TO_STRING (value);
        int length = string->Length();

        if (length == 0)
            return g_array_new(zero_terminated, TRUE, sizeof(char));

        const char *utf8_data = *Nan::Utf8String(string);
        g_array = g_array_sized_new (zero_terminated, FALSE, sizeof (char), length);
        return g_array_append_vals(g_array, utf8_data, length);

    } else if (value->IsArray ()) {
        auto array = Local<Array>::Cast (TO_OBJECT (value));
        int length = array->Length ();

        GITypeInfo* element_info = g_type_info_get_param_type (type_info, 0);
        gsize element_size = GetTypeSize(element_info);

        // FIXME this is so wrong
        g_array = g_array_sized_new (zero_terminated, FALSE, element_size, length);

        for (int i = 0; i < length; i++) {
            auto value = Nan::Get(array, i).ToLocalChecked();
            GIArgument arg;

            if (V8ToGIArgument(element_info, &arg, value, true)) {
                g_array_append_val (g_array, arg);
            } else {
                g_warning("V8ToGArray: couldnt convert value: %s",
                        *Nan::Utf8String(TO_STRING (value)) );
            }
        }

        g_base_info_unref (element_info);
    } else {
        Nan::ThrowTypeError("Not an array.");
    }

    return g_array;
}

static void *V8ArrayToCArray(GITypeInfo *type_info, Local<Value> value) {
    auto array = Local<Array>::Cast (TO_OBJECT (value));
    int length = array->Length();

    bool isZeroTerminated = g_type_info_is_zero_terminated(type_info);
    GITypeInfo* element_info = g_type_info_get_param_type (type_info, 0);
    gsize element_size = GetTypeSize(element_info);

    void *result = malloc(element_size * (length + (isZeroTerminated ? 1 : 0)));

    for (int i = 0; i < length; i++) {
        auto value = Nan::Get(array, i).ToLocalChecked();

        GIArgument arg;

        if (V8ToGIArgument(element_info, &arg, value, true)) {
            void* pointer = (void*)((ulong)result + i * element_size);
            memcpy(pointer, &arg, element_size);
        } else {
            WARN("couldnt convert value: %s", *Nan::Utf8String(TO_STRING (value)));
        }
    }

    if (isZeroTerminated) {
        void* pointer = (void*)((ulong)result + length * element_size);
        memset(pointer, 0, element_size);
    }

    g_base_info_unref (element_info);
    return result;
}

static void *V8TypedArrayToCArray(GITypeInfo *type_info, Local<Value> value) {
    auto array = Local<TypedArray>::Cast (TO_OBJECT (value));
    size_t length = array->ByteLength();

    bool isZeroTerminated = g_type_info_is_zero_terminated(type_info);
    GITypeInfo* element_info = g_type_info_get_param_type (type_info, 0);
    gsize element_size = GetTypeSize(element_info);

    void *result = malloc(element_size * (length + (isZeroTerminated ? 1 : 0)));

    array->CopyContents(result, length);

    if (isZeroTerminated) {
        void* pointer = (void*)((ulong)result + length * element_size);
        memset(pointer, 0, element_size);
    }

    g_base_info_unref (element_info);

    return result;
}

void *V8ToCArray(GITypeInfo *type_info, Local<Value> value) {
    if (value->IsString()) {
        Local<String> string = TO_STRING (value);
        const char *utf8_data = *Nan::Utf8String(string);
        return g_strdup(utf8_data);
    }

    if (value->IsArray()) {
        return V8ArrayToCArray(type_info, value);
    }

    if (value->IsTypedArray()) {
        return V8TypedArrayToCArray(type_info, value);
    }

    Nan::ThrowTypeError("Expected value to be an array");

    return NULL;
}

gpointer V8ToGList (GITypeInfo *type_info, Local<Value> value) {

    // FIXME can @value be null?
    if (!value->IsArray()) {
        Nan::ThrowTypeError("Invalid conversion from value to GList");
        return NULL;
    }

    Local<Array> array = Local<Array>::Cast(TO_OBJECT (value));
    int length = array->Length();

    if (length == 0)
        return NULL; // NULL is a valid empty GList

    GITypeTag   list_type = g_type_info_get_tag(type_info);
    GITypeInfo *element_info = g_type_info_get_param_type(type_info, 0);

    g_assert(element_info != NULL);

    void *list;
    if (list_type == GI_TYPE_TAG_GLIST)
        list = NULL;
    else if (list_type == GI_TYPE_TAG_GSLIST)
        list = NULL;
    else
        g_assert_not_reached();

    for (int i = 0; i < length; i++) {
        GIArgument arg;
        Local<Value> value = Nan::Get(array, i).ToLocalChecked();

        if (!V8ToGIArgument(element_info, &arg, value, false)) {
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

    g_base_info_unref(element_info);
    return list;
}

gpointer V8ToGHash (GITypeInfo *type_info, Local<Value> value) {

    if (!value->IsObject()) {
        Nan::ThrowTypeError("Expected object");
        return NULL;
    }

    GITypeInfo *key_type_info   = g_type_info_get_param_type (type_info, 0);
    GITypeInfo *value_type_info = g_type_info_get_param_type (type_info, 1);

    GITypeTag key_type_tag = g_type_info_get_tag (key_type_info);

    GHashFunc  hash_func;
    GEqualFunc equal_func;

    switch (key_type_tag) {
        case GI_TYPE_TAG_GTYPE:
        case GI_TYPE_TAG_UNICHAR:
        case GI_TYPE_TAG_BOOLEAN:
        case GI_TYPE_TAG_INT8:
        case GI_TYPE_TAG_UINT8:
        case GI_TYPE_TAG_INT16:
        case GI_TYPE_TAG_UINT16:
        case GI_TYPE_TAG_INT32:
        case GI_TYPE_TAG_UINT32:
            hash_func  = g_int_hash;
            equal_func = g_int_equal;
            break;
        case GI_TYPE_TAG_INT64:
        case GI_TYPE_TAG_UINT64:
            hash_func  = g_int64_hash;
            equal_func = g_int64_equal;
            break;
        case GI_TYPE_TAG_FLOAT:
        case GI_TYPE_TAG_DOUBLE:
            hash_func  = g_double_hash;
            equal_func = g_double_equal;
            break;
        case GI_TYPE_TAG_ARRAY:
        case GI_TYPE_TAG_INTERFACE:
        case GI_TYPE_TAG_GLIST:
        case GI_TYPE_TAG_GSLIST:
        case GI_TYPE_TAG_GHASH:
        case GI_TYPE_TAG_ERROR:
            hash_func  = g_direct_hash;
            equal_func = g_direct_equal;
            break;
        case GI_TYPE_TAG_VOID:
        case GI_TYPE_TAG_UTF8:
        case GI_TYPE_TAG_FILENAME:
        default:
            hash_func  = g_str_hash;
            equal_func = g_str_equal;
    }

    GHashTable* hash_table = g_hash_table_new (hash_func, equal_func);


    auto object = TO_OBJECT (value);
    auto keys = Nan::GetOwnPropertyNames(object).ToLocalChecked();

    for (uint32_t i = 0; i < keys->Length(); i++) {
        auto key   = Nan::Get(keys, i).ToLocalChecked();
        auto value = Nan::Get(object, key).ToLocalChecked();

        GIArgument key_arg;
        GIArgument value_arg;

        if (!V8ToGIArgument(key_type_info, &key_arg, key, false)) {
            char* message = g_strdup_printf("Couldn't convert key '%s'", *Nan::Utf8String(key));
            Nan::ThrowError(message);
            free(message);
            goto item_error;
        }

        if (!V8ToGIArgument(value_type_info, &value_arg, value, false)) {
            char* message = g_strdup_printf("Couldn't convert value for key '%s'", *Nan::Utf8String(key));
            Nan::ThrowError(message);
            free(message);
            goto item_error;
        }

        g_hash_table_insert (hash_table, key_arg.v_pointer, GIArgumentToHashPointer (&value_arg, value_type_info));

        continue;

item_error:
        /* Free everything we have converted so far. */
        FreeGIArgument(type_info, (GIArgument *) &hash_table, GI_TRANSFER_NOTHING, GI_DIRECTION_IN);
        hash_table = NULL;
        break;
    }

    g_base_info_unref(key_type_info);
    g_base_info_unref(value_type_info);

    return hash_table;
}

bool V8ToGIArgument(GIBaseInfo *gi_info, GIArgument *arg, Local<Value> value) {
    GIInfoType type = g_base_info_get_type (gi_info);

    switch (type) {
    case GI_INFO_TYPE_BOXED:
    case GI_INFO_TYPE_STRUCT:
    case GI_INFO_TYPE_UNION:
        arg->v_pointer = PointerFromWrapper(value);
        break;

    case GI_INFO_TYPE_FLAGS:
    case GI_INFO_TYPE_ENUM:
        arg->v_int = Nan::To<int32_t> (value).ToChecked();
        break;

    case GI_INFO_TYPE_OBJECT:
    {
        GType gtype = g_registered_type_info_get_g_type (gi_info);

        if (g_type_is_a(gtype, G_TYPE_PARAM)) {
            arg->v_pointer = ParamSpec::FromWrapper(value);
            break;
        }
        // fallthrough
    }
    case GI_INFO_TYPE_INTERFACE:
        arg->v_pointer = GObjectFromWrapper(value);
        break;

    case GI_INFO_TYPE_CALLBACK:
    default:
        print_info (gi_info);
        g_assert_not_reached ();
    }
    return true;
}

bool V8ToGIArgument(GITypeInfo *type_info, GIArgument *arg, Local<Value> value, bool may_be_null) {
    GITypeTag type_tag = g_type_info_get_tag (type_info);

    if (value->IsUndefined () || value->IsNull ()) {
        arg->v_pointer = NULL;

        if (!may_be_null && type_tag != GI_TYPE_TAG_VOID) {
            Nan::ThrowTypeError("Trying to convert null/undefined value to GIArgument.");
            return false;
        }

        return true;
    }

    switch (type_tag) {
    case GI_TYPE_TAG_VOID:
        if (g_type_info_is_pointer(type_info)) {
            arg->v_pointer = PointerFromWrapper(value);
            break;
        }
        arg->v_pointer = NULL;
        break;
    case GI_TYPE_TAG_BOOLEAN:
        arg->v_boolean = Nan::To<bool> (value).ToChecked();
        break;
    case GI_TYPE_TAG_INT8:
        arg->v_int8 = Nan::To<int32_t> (value).ToChecked();
        break;
    case GI_TYPE_TAG_INT16:
        arg->v_int16 = Nan::To<int32_t> (value).ToChecked();
        break;
    case GI_TYPE_TAG_INT32:
        arg->v_int = Nan::To<int32_t> (value).ToChecked();
        break;
    case GI_TYPE_TAG_INT64:
        arg->v_int64 = Nan::To<int64_t> (value).ToChecked();
        break;
    case GI_TYPE_TAG_UINT8:
        arg->v_uint8 = Nan::To<uint32_t> (value).ToChecked();
        break;
    case GI_TYPE_TAG_UINT16:
        arg->v_uint16 = Nan::To<uint32_t> (value).ToChecked();
        break;
    case GI_TYPE_TAG_UINT32:
        arg->v_uint = Nan::To<uint32_t> (value).ToChecked();
        break;
    case GI_TYPE_TAG_UINT64:
        arg->v_uint64 = Nan::To<int64_t> (value).ToChecked();
        break;
    case GI_TYPE_TAG_FLOAT:
        arg->v_float = Nan::To<double> (value).ToChecked();
        break;
    case GI_TYPE_TAG_DOUBLE:
        arg->v_double = Nan::To<double> (value).ToChecked();
        break;
    case GI_TYPE_TAG_GTYPE:
        arg->v_ulong = Nan::To<int64_t> (value).ToChecked();
        break;

    case GI_TYPE_TAG_UTF8:
        {
            arg->v_pointer = g_strdup (*Nan::Utf8String(value));
        }
        break;

    case GI_TYPE_TAG_FILENAME:
        {
            Nan::Utf8String str (value);
            const char *utf8_data = *str;
            arg->v_pointer = g_filename_from_utf8 (utf8_data, -1, NULL, NULL, NULL);
        }
        break;

    case GI_TYPE_TAG_ARRAY:
        {
            GIArrayType array_type = g_type_info_get_array_type (type_info);

            switch (array_type) {
            case GI_ARRAY_TYPE_C:
                arg->v_pointer = V8ToCArray(type_info, value);
                break;
            case GI_ARRAY_TYPE_ARRAY:
            case GI_ARRAY_TYPE_BYTE_ARRAY:
                arg->v_pointer = V8ToGArray(type_info, value);
                break;
            case GI_ARRAY_TYPE_PTR_ARRAY:
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
        {
            arg->v_pointer = V8ToGList(type_info, value);
        }
        break;

    case GI_TYPE_TAG_GHASH:
        {
            arg->v_pointer = V8ToGHash(type_info, value);
        }
        break;

    case GI_TYPE_TAG_ERROR:
        {
            arg->v_pointer = (GError *) PointerFromWrapper(value);
        }
        break;

    case GI_TYPE_TAG_UNICHAR: // FIXME
        arg->v_uint32 = Nan::To<uint32_t> (value).ToChecked();
        break;

    default:
        g_assert_not_reached ();
    }

    return true;
}

bool CanConvertV8ToGIArgument(GITypeInfo *type_info, Local<Value> value, bool may_be_null) {
    /*
     * The question we're asking here is "Can this javascript value be used as a ...?"
     * The answer to that question is almost always yes for javascript primitives,
     * because of javascript semantics (anything can be casted to anything).
     * For complex values (GObject, Boxed, arrays & lists) we do a more comprehensive
     * check.
     */

    GITypeTag type_tag = g_type_info_get_tag (type_info);

    if (value->IsUndefined () || value->IsNull ()) {
        return may_be_null;
    }

    switch (type_tag) {
    case GI_TYPE_TAG_VOID:
        return true;
    case GI_TYPE_TAG_BOOLEAN:
        return true;
    case GI_TYPE_TAG_INT8:
    case GI_TYPE_TAG_INT16:
    case GI_TYPE_TAG_INT32:
    case GI_TYPE_TAG_INT64:
    case GI_TYPE_TAG_UINT8:
    case GI_TYPE_TAG_UINT16:
    case GI_TYPE_TAG_UINT32:
    case GI_TYPE_TAG_UINT64:
    case GI_TYPE_TAG_FLOAT:
    case GI_TYPE_TAG_DOUBLE:
    case GI_TYPE_TAG_GTYPE:
        return value->IsNumber ();

    case GI_TYPE_TAG_UTF8:
        return true;

    case GI_TYPE_TAG_FILENAME:
        return true;

    case GI_TYPE_TAG_INTERFACE:
        {
            GIBaseInfo *interface_info = g_type_info_get_interface (type_info);
            GIInfoType type = g_base_info_get_type (interface_info);

            bool result;

            switch (type) {
            case GI_INFO_TYPE_OBJECT:
            case GI_INFO_TYPE_INTERFACE:
            case GI_INFO_TYPE_BOXED:
            case GI_INFO_TYPE_STRUCT:
            case GI_INFO_TYPE_UNION:
                result = ValueIsInstanceOfGType (value, g_registered_type_info_get_g_type (interface_info));
                break;
            case GI_INFO_TYPE_FLAGS:
            case GI_INFO_TYPE_ENUM:
                result = value->IsNumber();
                break;
            case GI_INFO_TYPE_CALLBACK:
                result = value->IsFunction();
                break;
            default:
                print_info (interface_info);
                g_assert_not_reached ();
            }
            g_base_info_unref(interface_info);

            return result;
        }

    case GI_TYPE_TAG_ARRAY:
    case GI_TYPE_TAG_GLIST:
    case GI_TYPE_TAG_GSLIST:
        {
            if (value->IsString() && IsUint8Array(type_info))
                return true;

            if (value->IsTypedArray())
                return true;

            if (!value->IsArray())
                return false;

            auto array = TO_OBJECT (value);
            int length = Nan::To<uint32_t> (Nan::Get(array, UTF8("length")).ToLocalChecked()).ToChecked();
            GIBaseInfo *element_info = g_type_info_get_param_type(type_info, 0);

            bool result = true;
            for (int i = 0; i < length; i++) {
                auto element = Nan::Get(array, i).ToLocalChecked();
                if (!CanConvertV8ToGIArgument(element_info, element, false)) {
                    result = false;
                    break;
                }
            }

            g_base_info_unref(element_info);
            return result;
        }

    case GI_TYPE_TAG_UNICHAR:
        return true;

    case GI_TYPE_TAG_GHASH:
        return value->IsObject();

    case GI_TYPE_TAG_ERROR:
        return true;

    default:
        printf("type tag: %s\n", g_type_tag_to_string(type_tag));
        g_assert_not_reached ();
    }

    return false;
}

void FreeGIArgument(GITypeInfo *type_info, GIArgument *arg, GITransfer transfer, GIDirection direction) {
    bool is_in  = direction == GI_DIRECTION_IN;
    bool is_out = direction == GI_DIRECTION_OUT || direction == GI_DIRECTION_INOUT;
    bool free_elements =
           (is_out && transfer == GI_TRANSFER_EVERYTHING)
        || (is_in  && transfer != GI_TRANSFER_EVERYTHING);

    if (is_in && transfer == GI_TRANSFER_EVERYTHING)
        return;

    if (is_out && transfer == GI_TRANSFER_NOTHING)
        return;

    if (arg->v_pointer == NULL)
        return;

    GITypeTag type_tag = g_type_info_get_tag (type_info);

    switch (type_tag) {
    case GI_TYPE_TAG_VOID:
    case GI_TYPE_TAG_BOOLEAN:
    case GI_TYPE_TAG_INT8:
    case GI_TYPE_TAG_UINT8:
    case GI_TYPE_TAG_INT16:
    case GI_TYPE_TAG_UINT16:
    case GI_TYPE_TAG_INT32:
    case GI_TYPE_TAG_UINT32:
    case GI_TYPE_TAG_INT64:
    case GI_TYPE_TAG_UINT64:
    case GI_TYPE_TAG_FLOAT:
    case GI_TYPE_TAG_DOUBLE:
    case GI_TYPE_TAG_GTYPE:
    case GI_TYPE_TAG_UNICHAR:
        return;

    case GI_TYPE_TAG_UTF8:
    case GI_TYPE_TAG_FILENAME:
    {
        g_free (arg->v_pointer);
        break;
    }

    case GI_TYPE_TAG_ARRAY:
    {
        FreeGIArgumentArray(type_info, arg, transfer, direction, -1);
        break;
    }

    case GI_TYPE_TAG_GLIST: // GList & GSList start with the same structure layout
    case GI_TYPE_TAG_GSLIST:
    {

        if (free_elements) {
            GITypeInfo *element_info = g_type_info_get_param_type(type_info, 0);

            GITransfer  element_transfer  = GI_TRANSFER_EVERYTHING;
            GIDirection element_direction = GI_DIRECTION_OUT;
            GIArgument  element_arg;

            GSList* list = (GSList *)arg->v_pointer;

            for (; list != NULL; list = list->next) {
                element_arg.v_pointer = list->data;
                FreeGIArgument(element_info, &element_arg, element_transfer, element_direction);
            }

            g_base_info_unref(element_info);
        }

        // This really exists
        if (is_in && transfer == GI_TRANSFER_CONTAINER)
            break;

        if (type_tag == GI_TYPE_TAG_GLIST)
            g_list_free((GList *)arg->v_pointer);
        else
            g_slist_free((GSList *)arg->v_pointer);

        break;
    }

    case GI_TYPE_TAG_INTERFACE:
    {
        GIBaseInfo *i_info = g_type_info_get_interface(type_info);
        GIInfoType  i_type = g_base_info_get_type(i_info);
        switch (i_type) {
            case GI_INFO_TYPE_OBJECT:
            case GI_INFO_TYPE_INTERFACE: // TODO(validate interface are handled)
                // handled by gobject.cc/boxed.cc
                break;
            case GI_INFO_TYPE_BOXED:
            case GI_INFO_TYPE_STRUCT:
            case GI_INFO_TYPE_UNION:
            {
                // handled by gobject.cc/boxed.cc
                break;
            }
            case GI_INFO_TYPE_ENUM:
            case GI_INFO_TYPE_FLAGS: // Nothing to do (~int32 values)
                break;
            case GI_INFO_TYPE_CALLBACK:
            {
                if (IsDestroyNotify(i_info)) // handled in Callback::DestroyNotify
                    break;
            }
            default:
                WARN("unhandled interface: %s (%s)",
                        g_base_info_get_name(i_info),
                        g_info_type_to_string(i_type));
                break;
        }
        g_base_info_unref(i_info);
        break;
    }

    case GI_TYPE_TAG_GHASH:
    {
        GHashTable* hash_table = (GHashTable *)arg->v_pointer;

        if (free_elements) {
            GITypeInfo *key_type_info   = g_type_info_get_param_type (type_info, 0);
            GITypeInfo *value_type_info = g_type_info_get_param_type (type_info, 1);

            GList* keys   = g_hash_table_get_keys (hash_table);
            GList* values = g_hash_table_get_values (hash_table);
            GIArgument element_arg;

            g_hash_table_steal_all(hash_table);

            for (; keys != NULL; keys = keys->next) {
                element_arg.v_pointer = keys->data;
                FreeGIArgument(key_type_info, &element_arg, GI_TRANSFER_EVERYTHING, GI_DIRECTION_OUT);
            }
            for (; values != NULL; values = values->next) {
                element_arg.v_pointer = values->data;
                FreeGIArgument(value_type_info, &element_arg, GI_TRANSFER_EVERYTHING, GI_DIRECTION_OUT);
            }

            g_base_info_unref(key_type_info);
            g_base_info_unref(value_type_info);
        }

        if (is_in && transfer == GI_TRANSFER_CONTAINER)
            break;

        g_hash_table_destroy(hash_table);
        break;
    }

    case GI_TYPE_TAG_ERROR:
    {
        g_error_free((GError *)arg->v_pointer);
        break;
    }

    default:
        g_warning("FreeGIArgument: reached default for type %s",
                g_type_tag_to_string(type_tag));
        break;
    }
}

void FreeGIArgumentArray(GITypeInfo *type_info, GIArgument *arg, GITransfer transfer, GIDirection direction, long length) {
    bool is_in  = direction == GI_DIRECTION_IN;
    bool is_out = direction == GI_DIRECTION_OUT || direction == GI_DIRECTION_INOUT;
    bool free_elements =
           (is_out && transfer == GI_TRANSFER_EVERYTHING)
        || (is_in  && transfer != GI_TRANSFER_EVERYTHING);

    if (is_in && transfer == GI_TRANSFER_EVERYTHING)
        return;

    if (is_out && transfer == GI_TRANSFER_NOTHING)
        return;

    if (arg->v_pointer == NULL)
        return;

    void* data = arg->v_pointer;
    auto array_type = g_type_info_get_array_type (type_info);

    /*
     * Free array elements
     */

    GITypeInfo *element_info = g_type_info_get_param_type(type_info, 0);
    GITypeTag element_tag = g_type_info_get_tag (element_info);

    /*
     * Some arguments are marked as arrays, although they really are strings.
     * In those cases, trying to free the elements (chars) would be bad.
     */
    if (G_TYPE_TAG_IS_BASIC(element_tag))
        free_elements = false;

    if (free_elements) {
        gsize element_size = GetTypeSize (element_info);
        bool isZeroTerminated = g_type_info_is_zero_terminated (type_info);

        switch (array_type) {
            case GI_ARRAY_TYPE_C:
                {
                    if (isZeroTerminated) {
                        length = g_strv_length ((gchar **)data);
                    }
                    else if (length == -1) {
                        length = g_type_info_get_array_fixed_size (type_info);
                        if (G_UNLIKELY (length == -1)) {
                            g_critical ("Unable to determine array length for %p", data);
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
                    GArray *g_array = (GArray*) data;
                    data   = g_array->data;
                    length = g_array->len;
                    element_size = g_array_get_element_size (g_array);
                    break;
                }
            case GI_ARRAY_TYPE_PTR_ARRAY:
                {
                    GPtrArray *ptr_array = (GPtrArray*) data;
                    data   = ptr_array->pdata;
                    length = ptr_array->len;
                    element_size = sizeof(gpointer);
                    break;
                }
            default:
                g_assert_not_reached();
                break;
        }

        auto item_transfer = direction == GI_DIRECTION_IN ? GI_TRANSFER_NOTHING : GI_TRANSFER_EVERYTHING;

        for (int i = 0; i < length; i++) {
            GIArgument item;
            memcpy (&item, (void*)((ulong)data + element_size * i), sizeof (GIArgument));
            FreeGIArgument (element_info, &item, item_transfer, direction);
        }

    }
    g_base_info_unref(element_info);

    // Does this really exist?
    if (is_in && transfer == GI_TRANSFER_CONTAINER)
        return;


    /*
     * Free the container
     */

    switch (array_type) {
        case GI_ARRAY_TYPE_C:
            {
                free(data);
                break;
            }
        case GI_ARRAY_TYPE_ARRAY:
        case GI_ARRAY_TYPE_BYTE_ARRAY:
        case GI_ARRAY_TYPE_PTR_ARRAY:
            {
                g_array_free ((GArray*)data, TRUE);
                break;
            }
        default:
            g_critical ("Unexpected array type %u",
                    g_type_info_get_array_type (type_info));
            break;
    }
}


/*
 * GValue conversion functions
 */

bool CanConvertV8ToGValue(GValue *gvalue, Local<Value> value) {
    if (G_VALUE_HOLDS_BOOLEAN (gvalue)) {
        return value->IsBoolean() || value->IsNumber();
    } else if (G_VALUE_HOLDS_CHAR (gvalue)) {
        return value->IsNumber();
    } else if (G_VALUE_HOLDS_UCHAR (gvalue)) {
        return value->IsNumber();
    } else if (G_VALUE_HOLDS_INT (gvalue)) {
        return value->IsNumber();
    } else if (G_VALUE_HOLDS_UINT (gvalue)) {
        return value->IsNumber();
    } else if (G_VALUE_HOLDS_LONG (gvalue)) {
        return value->IsNumber();
    } else if (G_VALUE_HOLDS_ULONG (gvalue)) {
        return value->IsNumber();
    } else if (G_VALUE_HOLDS_FLOAT (gvalue)) {
        return value->IsNumber();
    } else if (G_VALUE_HOLDS_DOUBLE (gvalue)) {
        return value->IsNumber();
    } else if (G_VALUE_HOLDS_GTYPE (gvalue)) {
        return value->IsNumber();
    } else if (G_VALUE_HOLDS_ENUM (gvalue)) {
        return value->IsNumber();
    } else if (G_VALUE_HOLDS_FLAGS (gvalue)) {
        return value->IsNumber();
    } else if (G_VALUE_HOLDS_STRING (gvalue)) {
        return value->IsString();
    } else if (G_VALUE_HOLDS_OBJECT (gvalue)) {
        return ValueIsInstanceOfGType(value, G_VALUE_TYPE (gvalue));
    } else if (G_VALUE_HOLDS_BOXED (gvalue)) {
        return ValueIsInstanceOfGType(value, G_VALUE_TYPE (gvalue));
    } else if (G_VALUE_HOLDS_PARAM (gvalue)) {
        return value->IsObject();
    } else if (G_VALUE_HOLDS_POINTER (gvalue)) {
        return false;
    } else if (G_VALUE_HOLDS_VARIANT (gvalue)) {
        return false;
    }

    ERROR("Unhandled GValue type: %s (please report this)",
            G_VALUE_TYPE_NAME (gvalue));
}

bool V8ToGValue(GValue *gvalue, Local<Value> value, bool mustCopy) {
    // by-value types
    if (G_VALUE_HOLDS_BOOLEAN (gvalue)) {
        g_value_set_boolean (gvalue, Nan::To<bool> (value).ToChecked());
    } else if (G_VALUE_HOLDS_CHAR (gvalue)) {
        g_value_set_schar (gvalue, Nan::To<int32_t> (value).ToChecked());
    } else if (G_VALUE_HOLDS_UCHAR (gvalue)) {
        g_value_set_uchar (gvalue, Nan::To<uint32_t> (value).ToChecked());
    } else if (G_VALUE_HOLDS_INT (gvalue)) {
        g_value_set_int (gvalue, Nan::To<int32_t> (value).ToChecked());
    } else if (G_VALUE_HOLDS_UINT (gvalue)) {
        g_value_set_uint (gvalue, Nan::To<uint32_t> (value).ToChecked());
    } else if (G_VALUE_HOLDS_LONG (gvalue)) {
        g_value_set_long (gvalue, Nan::To<int64_t> (value).ToChecked());
    } else if (G_VALUE_HOLDS_ULONG (gvalue)) {
        g_value_set_ulong (gvalue, Nan::To<uint32_t> (value).ToChecked());
    } else if (G_VALUE_HOLDS_INT64 (gvalue)) {
        g_value_set_int64 (gvalue, Nan::To<int64_t> (value).ToChecked());
    } else if (G_VALUE_HOLDS_UINT64 (gvalue)) {
        g_value_set_uint64 (gvalue, Nan::To<uint32_t> (value).ToChecked());
    } else if (G_VALUE_HOLDS_FLOAT (gvalue)) {
        g_value_set_float (gvalue, Nan::To<double> (value).ToChecked());
    } else if (G_VALUE_HOLDS_DOUBLE (gvalue)) {
        g_value_set_double (gvalue, Nan::To<double> (value).ToChecked());
    } else if (G_VALUE_HOLDS_GTYPE (gvalue)) {
        g_value_set_gtype (gvalue, Nan::To<int64_t> (value).ToChecked());
    } else if (G_VALUE_HOLDS_ENUM (gvalue)) {
        g_value_set_enum (gvalue, Nan::To<int32_t> (value).ToChecked());
    } else if (G_VALUE_HOLDS_FLAGS (gvalue)) {
        g_value_set_flags (gvalue, Nan::To<int32_t> (value).ToChecked());
    }
    // by-reference types
      else if (G_VALUE_HOLDS_STRING (gvalue)) {
        Nan::Utf8String str (value);
        const char *data = *str;
        g_value_set_string (gvalue, data);
    } else if (G_VALUE_HOLDS_OBJECT (gvalue)) {
        if (!ValueIsInstanceOfGType(value, G_VALUE_TYPE (gvalue))) {
            Throw::CannotConvertGType("GObject", G_VALUE_TYPE (gvalue));
            return false;
        }
        g_value_set_object (gvalue, GObjectFromWrapper (value));
    } else if (G_VALUE_HOLDS_BOXED (gvalue)) {
        if (!ValueIsInstanceOfGType(value, G_VALUE_TYPE (gvalue))) {
            Throw::CannotConvertGType("boxed", G_VALUE_TYPE (gvalue));
            return false;
        }
        if (mustCopy)
            g_value_set_boxed (gvalue, PointerFromWrapper(value));
        else
            g_value_set_static_boxed (gvalue, PointerFromWrapper(value));
    } else if (G_VALUE_HOLDS_PARAM (gvalue)) {
        if (!ValueIsInstanceOfGType(value, G_VALUE_TYPE (gvalue))) {
            Throw::CannotConvertGType("GParamSpec", G_VALUE_TYPE (gvalue));
            return false;
        }
        g_value_set_param (gvalue, ParamSpec::FromWrapper(value));
    } else if (G_VALUE_HOLDS_POINTER (gvalue)) {
        ERROR("Unsupported type: pointer");
    } else if (G_VALUE_HOLDS_VARIANT (gvalue)) {
        ERROR("Unsupported type: variant");
    } else {
        ERROR("Unhandled GValue type: %s (please report this)",
                g_type_name(G_VALUE_TYPE(gvalue)));
    }
    return true;
}

Local<Value> GValueToV8(const GValue *gvalue, bool mustCopy) {
    // by-value types
    if (G_VALUE_HOLDS_BOOLEAN (gvalue)) {
        return New<v8::Boolean>(g_value_get_boolean (gvalue));
    } else if (G_VALUE_HOLDS_CHAR (gvalue)) {
        return New<Integer>(g_value_get_schar (gvalue));
    } else if (G_VALUE_HOLDS_UCHAR (gvalue)) {
        return New<Integer>(g_value_get_uchar (gvalue));
    } else if (G_VALUE_HOLDS_INT (gvalue)) {
        return New<Integer>(g_value_get_int (gvalue));
    } else if (G_VALUE_HOLDS_UINT (gvalue)) {
        return New<v8::Uint32>(g_value_get_uint (gvalue));
    } else if (G_VALUE_HOLDS_LONG (gvalue)) {
        return New<Number>(g_value_get_long (gvalue));
    } else if (G_VALUE_HOLDS_ULONG (gvalue)) {
        return New<Number>(g_value_get_ulong (gvalue));
    } else if (G_VALUE_HOLDS_INT64 (gvalue)) {
        return New<Number>(g_value_get_int64 (gvalue));
    } else if (G_VALUE_HOLDS_UINT64 (gvalue)) {
        return New<Number>(g_value_get_uint64 (gvalue));
    } else if (G_VALUE_HOLDS_FLOAT (gvalue)) {
        return New<Number>(g_value_get_float (gvalue));
    } else if (G_VALUE_HOLDS_DOUBLE (gvalue)) {
        return New<Number>(g_value_get_double (gvalue));
    } else if (G_VALUE_HOLDS_GTYPE (gvalue)) {
        return New<Number>(g_value_get_gtype (gvalue));
    } else if (G_VALUE_HOLDS_ENUM (gvalue)) {
        return New<Integer>(g_value_get_enum (gvalue));
    } else if (G_VALUE_HOLDS_FLAGS (gvalue)) {
        return New<Integer>(g_value_get_flags (gvalue));
    }
    // by-reference types
      else if (G_VALUE_HOLDS_STRING (gvalue)) {
        auto string = g_value_get_string (gvalue);
        if (string)
            return New<String>(string).ToLocalChecked();
        else
            return Nan::EmptyString();
    } else if (G_VALUE_HOLDS_OBJECT (gvalue)) {
        return WrapperFromGObject (G_OBJECT (g_value_get_object (gvalue)));
    } else if (G_VALUE_HOLDS_BOXED (gvalue)) {
        GType gtype = G_VALUE_TYPE (gvalue);
        GIBaseInfo *info = g_irepository_find_by_gtype(NULL, gtype);
        if (info == NULL) {
            Throw::InvalidGType(gtype);
            return Nan::Null(); // FIXME(return a MaybeLocal instead?)
        }
        Local<Value> obj = WrapperFromBoxed(info, g_value_get_boxed(gvalue), mustCopy);
        g_base_info_unref(info);
        return obj;
    } else if (G_VALUE_HOLDS_PARAM (gvalue)) {
        GParamSpec *param_spec = g_value_get_param (gvalue);
        return ParamSpec::FromGParamSpec(param_spec);
    } else if (G_VALUE_HOLDS_POINTER (gvalue)) {
        ERROR("Unsuported type: pointer");
    } else if (G_VALUE_HOLDS_VARIANT (gvalue)) {
        ERROR("Unsuported type: variant");
    } else {
        ERROR("%s", G_VALUE_TYPE_NAME(gvalue));
    }
}


/*
 * JSValue utility functions
 */

bool ValueHasInternalField(Local<Value> value) {
    if (!value->IsObject())
        return false;

    Local<Object> object = TO_OBJECT (value);

    // Wait, this is not a GObject!
    if (object->InternalFieldCount() == 0)
        return false;

    return true;
}

bool ValueIsInstanceOfGType(Local<Value> value, GType g_type) {
    if (!ValueHasInternalField(value))
        return false;

    Local<Object> object = TO_OBJECT (value);
    GType object_type = (GType) TO_LONG (Nan::Get(object, UTF8("__gtype__")).ToLocalChecked());

    if (object_type == NOT_A_GTYPE || object_type == G_TYPE_NONE) {
        /*
         * Happens for objects that aren't GObjects but that are still
         * used by introspectable libs. (e.g. CairoContext objects)
         * In this case, we'll just make sure that the object contains at
         * least a pointer to something.
         * This case is also hit for boxeds that aren't registered but
         * can be used as registered boxeds. For example, GdkEventKey isn't
         * registered but can be used as a GdkEvent.
         */
        return object->InternalFieldCount() > 0;
    }

    return g_type_is_a(object_type, g_type);
}


/*
 * Helpers
 */

static gpointer GIArgumentToHashPointer (const GIArgument *arg, GITypeInfo *type_info) {
    GITypeTag type_tag = GetStorageType(type_info);

    switch (type_tag) {
        case GI_TYPE_TAG_INT8:
            return GINT_TO_POINTER (arg->v_int8);
        case GI_TYPE_TAG_UINT8:
            return GINT_TO_POINTER (arg->v_uint8);
        case GI_TYPE_TAG_INT16:
            return GINT_TO_POINTER (arg->v_int16);
        case GI_TYPE_TAG_UINT16:
            return GINT_TO_POINTER (arg->v_uint16);
        case GI_TYPE_TAG_INT32:
            return GINT_TO_POINTER (arg->v_int32);
        case GI_TYPE_TAG_UINT32:
            return GINT_TO_POINTER (arg->v_uint32);
        case GI_TYPE_TAG_GTYPE:
            return GSIZE_TO_POINTER (arg->v_size);
        case GI_TYPE_TAG_UTF8:
        case GI_TYPE_TAG_FILENAME:
        case GI_TYPE_TAG_INTERFACE:
        case GI_TYPE_TAG_ARRAY:
            return arg->v_pointer;
        default:
            g_critical ("Unsupported type %s", g_type_tag_to_string(type_tag));
            return arg->v_pointer;
    }
}

static void HashPointerToGIArgument (GIArgument *arg, GITypeInfo *type_info) {
    GITypeTag type_tag = GetStorageType (type_info);

    switch (type_tag) {
        case GI_TYPE_TAG_INT8:
            arg->v_int8 = (gint8)GPOINTER_TO_INT (arg->v_pointer);
            break;
        case GI_TYPE_TAG_INT16:
            arg->v_int16 = (gint16)GPOINTER_TO_INT (arg->v_pointer);
            break;
        case GI_TYPE_TAG_INT32:
            arg->v_int32 = (gint32)GPOINTER_TO_INT (arg->v_pointer);
            break;
        case GI_TYPE_TAG_UINT8:
            arg->v_uint8 = (guint8)GPOINTER_TO_UINT (arg->v_pointer);
            break;
        case GI_TYPE_TAG_UINT16:
            arg->v_uint16 = (guint16)GPOINTER_TO_UINT (arg->v_pointer);
            break;
        case GI_TYPE_TAG_UINT32:
            arg->v_uint32 = (guint32)GPOINTER_TO_UINT (arg->v_pointer);
            break;
        case GI_TYPE_TAG_GTYPE:
            arg->v_size = GPOINTER_TO_SIZE (arg->v_pointer);
            break;
        case GI_TYPE_TAG_UTF8:
        case GI_TYPE_TAG_FILENAME:
        case GI_TYPE_TAG_INTERFACE:
        case GI_TYPE_TAG_ARRAY:
            break;
        default:
            g_critical ("Unsupported type %s", g_type_tag_to_string(type_tag));
    }
}

static bool IsUint8Array (GITypeInfo *type_info) {
    GITypeTag type_tag = g_type_info_get_tag (type_info);
    GIBaseInfo *element_info = g_type_info_get_param_type(type_info, 0);
    GIArrayType array_type = g_type_info_get_array_type (type_info);

    bool result =
        type_tag == GI_TYPE_TAG_ARRAY
        && array_type == GI_ARRAY_TYPE_C
        && g_type_info_get_tag (element_info) == GI_TYPE_TAG_UINT8;

    g_base_info_unref(element_info);

    return result;
}


};
