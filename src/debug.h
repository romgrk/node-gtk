
#pragma once

#include <girepository.h>

#define __FILENAME__ (strrchr(__FILE__, '/') ? strrchr(__FILE__, '/') + 1 : __FILE__)

#define WARN(f,s) \
    do { \
        printf("\x1b[1;38;5;202m"); \
        printf(f, s); \
        printf("\x1b[0m\n"); } \
    while (0)

#ifdef NDEBUG
#define log(...)
#else
#define log(...) \
    do { \
        printf("\x1b[1;38;5;33m"); \
        printf("%s:\x1b[0m\x1b[1m %i: \x1b[0m", __FILENAME__, __LINE__); \
        printf(__VA_ARGS__); \
        printf("\n"); \
    } while (0)
#endif

namespace GNodeJS {

void print_gobject (GObject *gobject) ;
void print_gtype (GType type) ;
void print_name (GIBaseInfo *base_info) ;
void print_value (const GValue *gvalue) ;
void print_info (GIBaseInfo *base_info) ;
void print_struct_info (GIStructInfo *struct_info) ;
void print_union_info (GIBaseInfo *struct_info) ;
void print_callable_info (GICallableInfo *info);
void print_func_info (GIFunctionInfo *func_info) ;
void print_attributes (GIBaseInfo *base_info) ;
void print_klass (void *klass) ;
void print_type (GType type) ;
void print_namespaces () ;

};
