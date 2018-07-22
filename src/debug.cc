
#include <node.h>
#include <girepository.h>
#include <glib-object.h>

#include "debug.h"
#include "value.h"
#include "boxed.h"
#include "gobject.h"
#include "type.h"

#include <cstdio>

namespace GNodeJS {


void print_gobject (GObject *gobject) {
    printf("\x1b[91mGObject: %s::%s \x1b[0m\n",
            G_OBJECT_TYPE_NAME (gobject),
            G_OBJECT_CLASS_NAME (gobject)
    );
}

void print_info (GIBaseInfo *base_info) {
    GIInfoType info_type = g_base_info_get_type (base_info);

    if (!GI_IS_TYPE_INFO (base_info))
        printf("%s::\x1b[91m%s\x1b[0m: \t",
                g_base_info_get_namespace (base_info),
                g_base_info_get_name (base_info)
                );
    printf("\x1b[0m(info_type == \x1b[93m %s\x1b[0m)\t",
            g_info_type_to_string (info_type));
    if (GI_IS_REGISTERED_TYPE_INFO(base_info)) {
        GType gtype = g_registered_type_info_get_g_type(base_info);
        print_gtype(gtype);
    }
    printf("\n");

    if (GI_IS_ARG_INFO(base_info))             printf("GI_IS_ARG_INFO\n");
    if (GI_IS_ENUM_INFO(base_info))            printf("GI_IS_ENUM_INFO\n");
    if (GI_IS_TYPE_INFO(base_info))            printf("GI_IS_TYPE_INFO\n");
    if (GI_IS_FIELD_INFO(base_info))           printf("GI_IS_FIELD_INFO\n");
    if (GI_IS_VALUE_INFO(base_info))           printf("GI_IS_VALUE_INFO\n");
    if (GI_IS_OBJECT_INFO(base_info))          printf("GI_IS_OBJECT_INFO\n");
    if (GI_IS_SIGNAL_INFO(base_info))          printf("GI_IS_SIGNAL_INFO\n");
    if (GI_IS_STRUCT_INFO(base_info))          printf("GI_IS_STRUCT_INFO\n");
    if (GI_IS_CALLABLE_INFO(base_info))        printf("GI_IS_CALLABLE_INFO\n");
    if (GI_IS_CONSTANT_INFO(base_info))        printf("GI_IS_CONSTANT_INFO\n");
    if (GI_IS_FUNCTION_INFO(base_info))        printf("GI_IS_FUNCTION_INFO\n");
    if (GI_IS_PROPERTY_INFO(base_info))        printf("GI_IS_PROPERTY_INFO\n");
    if (GI_IS_INTERFACE_INFO(base_info))       printf("GI_IS_INTERFACE_INFO\n");
    if (GI_IS_REGISTERED_TYPE_INFO(base_info)) printf("GI_IS_REGISTERED_TYPE_INFO\n");

    //printf("--- Attributes: ---\n");
    //print_attributes(base_info);
    //printf("-------------------\n");

    if (info_type == GI_INFO_TYPE_OBJECT) {
        printf("type_name: \x1b[93m %s \t\x1b[0m type_init: \x1b[93m %s \t\x1b[93m %s \x1b[0m \n",
                g_object_info_get_type_name (base_info),
                g_object_info_get_type_init (base_info),
               (g_object_info_get_abstract(base_info) ? "Abstract" : ""));
        printf("n_interfaces: \x1b[93m %i\x1b[0m\t", g_object_info_get_n_interfaces (base_info));
        printf("n_properties: \x1b[93m %i\x1b[0m\t", g_object_info_get_n_properties (base_info));
        printf("n_methods: \x1b[93m %i\x1b[0m\n", g_object_info_get_n_methods (base_info));
    } else if (info_type == GI_INFO_TYPE_INTERFACE) {
        printf("n_prerequisites: \x1b[93m%i\x1b[0m \t n_properties: \x1b[93m%i\x1b[0m \n",
                g_interface_info_get_n_prerequisites (base_info),
                g_interface_info_get_n_properties (base_info)
        );
        printf("n_signals: \x1b[93m %i\x1b[0m\n", g_interface_info_get_n_signals (base_info));
        printf("n_methods: \x1b[93m %i\x1b[0m\n", g_interface_info_get_n_methods (base_info));
        printf("n_vfuncs: \x1b[93m %i\x1b[0m\n", g_interface_info_get_n_vfuncs (base_info));
    } else if (info_type == GI_INFO_TYPE_UNION) {
        print_union_info (base_info);
    } else if (info_type == GI_INFO_TYPE_STRUCT) {
        print_struct_info(base_info);
    } else if (info_type == GI_INFO_TYPE_BOXED) {
        print_struct_info(base_info);
    } else if (info_type == GI_INFO_TYPE_FUNCTION) {
        print_func_info(base_info);
    } else if (info_type == GI_INFO_TYPE_FIELD) {
        print_attributes(base_info);
    }

    printf("\n");

    GIBaseInfo *container = g_base_info_get_container(base_info);
    if (container)
        print_info(container);

    printf("\x1b[0m");
}

void print_struct_info (GIStructInfo *info) {
    printf("\x1b[34msize\x1b[0m %zu \t \x1b[38mis gtype struct? \x1b[91m%s \x1b[0m\n",
        g_struct_info_get_size (info),
        g_struct_info_is_gtype_struct (info) ? "true" : "false"
        );
    gint n_fields = g_struct_info_get_n_fields(info);
    gint n_methods = g_struct_info_get_n_methods(info);
    printf("\x1b[38mfields:\x1b[0m %i \t \x1b[38mmethods:\x1b[0m %i \n",
            n_fields,
            n_methods );
    for (int i = 0; i < n_fields; i++) {
        GIFieldInfo *field = g_struct_info_get_field(info, i);
        GITypeInfo *type = g_field_info_get_type(field);
        GITypeTag tag = g_type_info_get_tag(type);
        printf("\t\x1b[94m%s \x1b[38m::\x1b[0m %s \t @::%i \n",
                g_base_info_get_name(field),
                g_type_tag_to_string(tag),
                g_field_info_get_offset(field)
                );
        g_base_info_unref (field);
        g_base_info_unref (type);
    }
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *func = g_struct_info_get_method(info, i);
        print_func_info(func);
        g_base_info_unref (func);
    }
}

void print_union_info (GIBaseInfo *info) {
    gint n_fields = g_union_info_get_n_fields(info);
    gint n_methods = g_union_info_get_n_methods(info);
    printf("size: %zu\t\x1b[38mfields:\x1b[0m %i \t \x1b[38mmethods:\x1b[0m %i \t discriminated? %s\n",
            g_union_info_get_size(info),
            n_fields,
            n_methods,
            (g_union_info_is_discriminated(info)==TRUE) ? "true" : "false"
            );
    for (int i = 0; i < n_fields; i++) {
        GIFieldInfo *field = g_union_info_get_field(info, i);
        GITypeInfo *type = g_field_info_get_type(field);
        GITypeTag tag = g_type_info_get_tag(type);
        printf("\t\x1b[94m%s \x1b[38m::\x1b[0m %s \t @::%i \n",
                g_base_info_get_name(field),
                g_type_tag_to_string(tag),
                g_field_info_get_offset(field)
                );
        g_base_info_unref (field);
        g_base_info_unref (type);
    }
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *func = g_union_info_get_method(info, i);
        print_func_info(func);
        g_base_info_unref (func);
    }

}

void print_callable_info (GICallableInfo *info) {
    GIFunctionInfoFlags flags = g_function_info_get_flags(info);

    GITypeInfo return_info;
    g_callable_info_load_return_type(info, &return_info);
    auto typeName = GetTypeName(&return_info);
    printf("%s %s (", typeName, g_base_info_get_name(info));
    free(typeName);

    int n_args = g_callable_info_get_n_args(info);
    for (int i = 0; i < n_args; i++) {
        GIArgInfo arg_info;
        GITypeInfo type_info;
        g_callable_info_load_arg(info, i, &arg_info);
        g_arg_info_load_type(&arg_info, &type_info);
        auto typeName = GetTypeName(&type_info);
        printf("%s %s", typeName, g_base_info_get_name(&arg_info));
        free(typeName);
        if (i < n_args - 1)
            printf(", ");
    }
    printf(")");

    //GIPropertyInfo *prop = g_function_info_get_property(func);
    if (flags & GI_FUNCTION_IS_GETTER)
        printf(" GET ");
    if (flags & GI_FUNCTION_IS_SETTER)
        printf(" SET ");
    if (flags & GI_FUNCTION_IS_CONSTRUCTOR)
        printf(" CONSTRUCTOR ");
    if (flags & GI_FUNCTION_IS_METHOD)
        printf(" METHOD ");
    if (flags & GI_FUNCTION_WRAPS_VFUNC)
        printf(" VFUNC ");

    printf("\n");
}

void print_func_info (GIFunctionInfo *func) {
    const gchar *symbol = g_function_info_get_symbol(func);
    GIFunctionInfoFlags flags = g_function_info_get_flags(func);
    printf("\t\x1b[95m%s\x1b[0m() \t\x1b[35m@%s",
            g_base_info_get_name(func),
            symbol);

    //GIPropertyInfo *prop = g_function_info_get_property(func);
    if (flags & GI_FUNCTION_IS_GETTER)
        printf(" GET ");
    if (flags & GI_FUNCTION_IS_SETTER)
        printf(" SET ");
    if (flags & GI_FUNCTION_IS_CONSTRUCTOR)
        printf(" CONSTRUCTOR ");
    if (flags & GI_FUNCTION_IS_METHOD)
        printf(" METHOD ");
    if (flags & GI_FUNCTION_WRAPS_VFUNC)
        printf(" VFUNC ");

    GITypeInfo *return_type = g_callable_info_get_return_type(func);
    GITypeTag tag = g_type_info_get_tag(return_type);
    printf("\t: %s \n", g_type_tag_to_string(tag));
    g_base_info_unref(return_type);
}

void print_value (const GValue *gvalue) {
    GType type = G_VALUE_TYPE(gvalue);
    GType parent = g_type_parent (type);
    gchar *contents = g_strdup_value_contents (gvalue);
    printf ("\x1b[93m%s \x1b[91mTypeName: %s \t TypeParent: %s \n",
            contents,
            G_VALUE_TYPE_NAME(gvalue),
            g_type_name(parent) );
    g_free(contents);
}

void print_gtype (GType type) {
    GType t = type;
    GString *str = g_string_new(g_type_name(t));

    while(!G_TYPE_IS_FUNDAMENTAL(t) && t != 0) {
        t = g_type_parent(t);
        g_string_prepend(str, " -> ");
        g_string_prepend(str, g_type_name(t));
    }

    gchar *data = g_string_free(str, FALSE);

    printf("%s", data);

    g_free(data);
}

void print_type (GType type) {
    GType t = type;
    while(!G_TYPE_IS_FUNDAMENTAL(type) && t != 0) {
        printf("\t\x1b[92m -> %s \t (%lu)\x1b[0m\n", g_type_name(t), t);
        t = g_type_parent(t);
    }
}

void print_klass (void * klass) {
    printf("\x1b[38;5;202m");
    printf("klass: %s  (type: %lu )",
            G_OBJECT_CLASS_NAME (klass),
            G_OBJECT_CLASS_TYPE (klass) );
    printf("\x1b[0m\n");
}

void print_attributes (GIBaseInfo *base_info) {
    GIAttributeIter iter = { 0, 0, 0, 0};
    char *name;
    char *value;
    while (g_base_info_iterate_attributes (base_info, &iter, &name, &value))
    {
        printf ("\t@ %s : %s\n", name, value);
    }
}

void print_namespaces () {
    printf("Loaded: ");
    gchar **loaded_ns = g_irepository_get_loaded_namespaces(NULL);
    for (int i = 0; loaded_ns[i]; i++) {
        printf("\t %s ", loaded_ns[i]);
    }
    printf("\n");
}

};
