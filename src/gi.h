// #pragma once
#ifndef GI_H
#define GI_H

//#include <node.h>
//#include <nan.h>
#include <girepository.h>

#define N(type, prop, inst)   g_##type##_info_get_n_##prop (inst)
#define UTF8(s)         Nan::New<v8::String> (s).ToLocalChecked()
#define STRING(s)       Nan::New<v8::String> (s).ToLocalChecked()

namespace  GNodeJS {

typedef GIBaseInfo* Info;

} /*  GNodeJS  */

#endif
