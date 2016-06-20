
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <girffi.h>

using v8::Local;
using Nan::WeakCallbackInfo;

namespace GNodeJS {

struct FunctionInfo {
    GIFunctionInfo   *info;
    GIFunctionInvoker invoker;
};

struct Parameter {
    enum {
        NORMAL, ARRAY, SKIP,
    } type;
};

NAN_METHOD(FunctionInvoker) ;

void FunctionDestroyed(const WeakCallbackInfo<FunctionInfo> &data) ;

Local<v8::Function> MakeFunction(GIBaseInfo *base_info);

Local<v8::String>   FunctionToString(GIFunctionInfo *func_info);

};
