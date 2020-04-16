
#include "gi.h"
#include "macros.h"
#include "type.h"
#include "util.h"
#include "debug.h"

using v8::FunctionTemplate;
using v8::Persistent;

namespace GNodeJS {

char *GetInfoName (GIBaseInfo* info) {
    const char* info_name = g_base_info_get_name (info);

    if (info_name == NULL)
        return g_strdup ("(NULL)");

    char* name = g_strdup (info_name);

    GIBaseInfo *parent;
    while ((parent = g_base_info_get_container (info)) != NULL) {
        char *new_name = g_strconcat (g_base_info_get_name(parent), ".", name, NULL);
        g_free (name);
        name = new_name;
    }

    char *new_name = g_strconcat (g_base_info_get_namespace(info), ".", name, NULL);
    g_free (name);
    name = new_name;

    return name;
}

char *GetTypeName (GITypeInfo *type_info) {
    GITypeTag type_tag = g_type_info_get_tag (type_info);

    switch (type_tag) {
        case GI_TYPE_TAG_BOOLEAN:
            return g_strdup("Boolean");

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
            return g_strdup("Number");

        case GI_TYPE_TAG_GTYPE:
            return g_strdup("GType");

        case GI_TYPE_TAG_UNICHAR:
            return g_strdup("Char");

        case GI_TYPE_TAG_UTF8:
        case GI_TYPE_TAG_FILENAME:
            return g_strdup("String");

        case GI_TYPE_TAG_INTERFACE:
        {
            GIBaseInfo *info = g_type_info_get_interface (type_info);
            auto result = g_strdup_printf("%s.%s",
                    g_base_info_get_namespace(info), g_base_info_get_name(info));
            g_base_info_unref (info);
            return result;
        }

        case GI_TYPE_TAG_ARRAY:
        case GI_TYPE_TAG_GLIST:
        case GI_TYPE_TAG_GSLIST:
        {
            GITypeInfo *elem_info = g_type_info_get_param_type(type_info, 0);
            auto elem_name = GetTypeName (elem_info);
            auto result = g_strdup_printf("%s[]", elem_name);

            g_base_info_unref(elem_info);
            g_free(elem_name);

            return result;
        }

        case GI_TYPE_TAG_GHASH:
        case GI_TYPE_TAG_ERROR:
        case GI_TYPE_TAG_VOID:
        default:
            return g_strdup(g_type_tag_to_string(type_tag));
    }
}

gsize GetTypeSize (GITypeInfo *type_info) {
    gsize size = 0;

    GITypeTag type_tag = g_type_info_get_tag (type_info);

    switch (type_tag) {
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
        {
            size = GetTypeTagSize (type_tag);
            break;
        }

        case GI_TYPE_TAG_INTERFACE:
        {
            GIBaseInfo *info;
            GIInfoType info_type;

            info = g_type_info_get_interface (type_info);
            info_type = g_base_info_get_type (info);

            size = sizeof (gpointer);

            switch (info_type) {
                case GI_INFO_TYPE_STRUCT:
                    if (!g_type_info_is_pointer (type_info)) {
                        size = g_struct_info_get_size ( (GIStructInfo *) info);
                    }
                    break;
                case GI_INFO_TYPE_UNION:
                    if (!g_type_info_is_pointer (type_info)) {
                        size = g_union_info_get_size ( (GIUnionInfo *) info);
                    }
                    break;
                case GI_INFO_TYPE_ENUM:
                case GI_INFO_TYPE_FLAGS:
                    if (!g_type_info_is_pointer (type_info)) {
                        size = GetTypeTagSize (g_enum_info_get_storage_type ( (GIEnumInfo *) info));
                    }
                    break;
                case GI_INFO_TYPE_BOXED:
                case GI_INFO_TYPE_OBJECT:
                case GI_INFO_TYPE_INTERFACE:
                case GI_INFO_TYPE_CALLBACK:
                    DEBUG("size for %s", g_info_type_to_string(info_type));
                    break;
                case GI_INFO_TYPE_VFUNC:
                case GI_INFO_TYPE_FUNCTION:
                case GI_INFO_TYPE_CONSTANT:
                case GI_INFO_TYPE_VALUE:
                case GI_INFO_TYPE_SIGNAL:
                case GI_INFO_TYPE_PROPERTY:
                case GI_INFO_TYPE_FIELD:
                case GI_INFO_TYPE_ARG:
                case GI_INFO_TYPE_TYPE:
                case GI_INFO_TYPE_INVALID:
                case GI_INFO_TYPE_UNRESOLVED:
                default:
                    ERROR("info type: %s", g_info_type_to_string(info_type));
                    break;
            }

            g_base_info_unref (info);
            break;
        }
        case GI_TYPE_TAG_ARRAY:
        case GI_TYPE_TAG_VOID:
        case GI_TYPE_TAG_UTF8:
        case GI_TYPE_TAG_FILENAME:
        case GI_TYPE_TAG_GLIST:
        case GI_TYPE_TAG_GSLIST:
        case GI_TYPE_TAG_GHASH:
        case GI_TYPE_TAG_ERROR:
            size = sizeof(gpointer);
            break;
    }

    return size;
}

gsize GetComplexTypeSize (GIBaseInfo *info) {
    GIInfoType info_type = g_base_info_get_type (info);
    gsize size = sizeof (gpointer);

    switch (info_type) {
        case GI_INFO_TYPE_STRUCT:
            return g_struct_info_get_size ( (GIStructInfo *) info);
        case GI_INFO_TYPE_UNION:
            return g_union_info_get_size ( (GIUnionInfo *) info);
        case GI_INFO_TYPE_ENUM:
        case GI_INFO_TYPE_FLAGS:
            return GetTypeTagSize (g_enum_info_get_storage_type ( (GIEnumInfo *) info));
        case GI_INFO_TYPE_BOXED:
        case GI_INFO_TYPE_OBJECT:
        case GI_INFO_TYPE_INTERFACE:
        case GI_INFO_TYPE_CALLBACK:
            DEBUG("size for %s", g_info_type_to_string(info_type));
            return sizeof(gpointer);
        case GI_INFO_TYPE_VFUNC:
        case GI_INFO_TYPE_FUNCTION:
        case GI_INFO_TYPE_CONSTANT:
        case GI_INFO_TYPE_VALUE:
        case GI_INFO_TYPE_SIGNAL:
        case GI_INFO_TYPE_PROPERTY:
        case GI_INFO_TYPE_FIELD:
        case GI_INFO_TYPE_ARG:
        case GI_INFO_TYPE_TYPE:
        case GI_INFO_TYPE_INVALID:
        case GI_INFO_TYPE_UNRESOLVED:
        default:
            ERROR("info type: %s", g_info_type_to_string(info_type));
    }
}

gsize GetTypeTagSize (GITypeTag type_tag) {
    switch (type_tag) {
        case GI_TYPE_TAG_BOOLEAN:
            return sizeof (gboolean);
            break;
        case GI_TYPE_TAG_INT8:
        case GI_TYPE_TAG_UINT8:
            return sizeof (gint8);
            break;
        case GI_TYPE_TAG_INT16:
        case GI_TYPE_TAG_UINT16:
            return sizeof (gint16);
            break;
        case GI_TYPE_TAG_INT32:
        case GI_TYPE_TAG_UINT32:
            return sizeof (gint32);
            break;
        case GI_TYPE_TAG_INT64:
        case GI_TYPE_TAG_UINT64:
            return sizeof (gint64);
            break;
        case GI_TYPE_TAG_FLOAT:
            return sizeof (gfloat);
            break;
        case GI_TYPE_TAG_DOUBLE:
            return sizeof (gdouble);
            break;
        case GI_TYPE_TAG_GTYPE:
            return sizeof (GType);
            break;
        case GI_TYPE_TAG_UNICHAR:
            return sizeof (gunichar);
            break;
        case GI_TYPE_TAG_VOID:
        case GI_TYPE_TAG_UTF8:
        case GI_TYPE_TAG_FILENAME:
        case GI_TYPE_TAG_ARRAY:
        case GI_TYPE_TAG_INTERFACE:
        case GI_TYPE_TAG_GLIST:
        case GI_TYPE_TAG_GSLIST:
        case GI_TYPE_TAG_GHASH:
        case GI_TYPE_TAG_ERROR:
            g_assert_not_reached ();
    }

    return 0;
}

GITypeTag GetStorageType (GITypeInfo *type_info) {
    GITypeTag type_tag = g_type_info_get_tag (type_info);

    if (type_tag == GI_TYPE_TAG_INTERFACE) {
        GIBaseInfo *interface = g_type_info_get_interface (type_info);
        GIInfoType interface_type = g_base_info_get_type (interface);

        if (interface_type == GI_INFO_TYPE_ENUM || interface_type == GI_INFO_TYPE_FLAGS)
            type_tag = g_enum_info_get_storage_type ((GIEnumInfo *)interface);

        g_base_info_unref (interface);
    }

    return type_tag;
}

};

