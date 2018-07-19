
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <girffi.h>

#include "gi.h"

using v8::Function;
using v8::Local;
using v8::MaybeLocal;
using v8::String;
using Nan::FunctionCallbackInfo;
using Nan::WeakCallbackInfo;

namespace GNodeJS {

struct FunctionInfo {
    GIFunctionInfo   *info;
    GIFunctionInvoker invoker;
};

enum ParameterType {
    NORMAL, ARRAY, SKIP, CALLBACK
};

struct Parameter {
    ParameterType type;

    GIDirection direction;
    GIArgument data;
    int length;
};

void FunctionInvoker (const FunctionCallbackInfo<Value> &info);
void FunctionDestroyed (const WeakCallbackInfo<FunctionInfo> &data);

Local<Function>      MakeFunction (GIBaseInfo *base_info);
MaybeLocal<Function> MakeVirtualFunction(GIBaseInfo *info, GType implementor);

};
