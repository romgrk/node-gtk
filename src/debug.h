
#pragma once

#include <string.h>
#include <girepository.h>

#define FILE_NAME (strrchr(__FILE__, '/') ? strrchr(__FILE__, '/') + 1 : __FILE__)
#ifdef __PRETTY_FUNCTION__
#define FUNCTION_NAME __PRETTY_FUNCTION__
#else
#define FUNCTION_NAME __func__
#endif

#define WARN(f,s) \
    do { \
        printf("\x1b[1;38;5;202m"); \
        printf(f, s); \
        printf("\x1b[0m\n"); } \
    while (0)

#ifdef NDEBUG
#define debug(...) do {} while(0)
#else
#define debug(...) \
    do { \
        printf("\x1b[1;38;5;226m[DEBUG] "); \
        printf("%s:\x1b[0m\x1b[1m %s: %i: \x1b[0m", FILE_NAME, FUNCTION_NAME, __LINE__); \
        printf(__VA_ARGS__); \
        printf("\n"); \
    } while (0)
#endif

#ifdef NDEBUG
#define LOG(...) do {} while(0)
#else
#define LOG(...) \
    do { \
        printf("\x1b[1;38;5;33m[INFO] "); \
        printf("%s:\x1b[0m\x1b[1m %s: %i: \x1b[0m", FILE_NAME, FUNCTION_NAME, __LINE__); \
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
