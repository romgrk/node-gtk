
#pragma once

#include <girepository.h>

//#define SUCCESS(s) printf("\x1b[1;38;5;46m%s\x1b[0m\n", s)
#define SUCCESS(f,s) \
    do { \
        printf("\x1b[1;38;5;46m"); \
        printf(f, s); \
        printf("\x1b[0m\n"); } \
    while (0)

//#define LOG(s) printf("\x1b[1;38;5;33m%s\x1b[0m\n", s)
#define LOG(f,s) \
    do { \
        printf("\x1b[1;38;5;33m"); \
        printf(f, s); \
        printf("\x1b[0m\n"); } \
    while (0)

//#define WARN(s) printf("\x1b[1;38;5;202m%s\x1b[0m\n", s)
#define WARN(f,s) \
    do { \
        printf("\x1b[1;38;5;202m"); \
        printf(f, s); \
        printf("\x1b[0m\n"); } \
    while (0)

#ifdef DEBUG
#undef DEBUG
#endif
#define DEBUG(f,s) \
    do { \
        printf("\x1b[1;93m"); \
        printf(f, s); \
        printf("\x1b[0m\n"); } \
    while (0)

namespace GNodeJS {

void print_gobject (GObject *gobject) ;
void print_gtype (GType type) ;
void print_name (GIBaseInfo *base_info) ;
void print_value (const GValue *gvalue) ;
void print_info (GIBaseInfo *base_info) ;
void print_struct_info (GIStructInfo *struct_info) ;
void print_union_info (GIBaseInfo *struct_info) ;
void print_func_info (GIFunctionInfo *func_info) ;
void print_attributes (GIBaseInfo *base_info) ;
void print_klass (void *klass) ;
void print_type (GType type) ;
void print_namespaces () ;

};
