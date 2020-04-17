
#pragma once

#include <string.h>
#include <girepository.h>

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
