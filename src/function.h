
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

enum ParameterType {
    NORMAL, ARRAY, SKIP, CALLBACK
};

struct Parameter {
    ParameterType type;

    GIDirection direction;
    GIArgument data;
    long length;
};

struct FunctionInfo {
    GIFunctionInfo   *info;
    GIFunctionInvoker invoker;

    bool is_method;
    bool can_throw;

    int n_callable_args;
    int n_total_args;
    int n_out_args;
    int n_in_args;

    Parameter* call_parameters;

    FunctionInfo(GIBaseInfo* info);
    ~FunctionInfo();

    void Init();

    bool TypeCheck (const Nan::FunctionCallbackInfo<Value> &info);
};

void FunctionInvoker (const FunctionCallbackInfo<Value> &info);
void FunctionDestroyed (const WeakCallbackInfo<FunctionInfo> &data);

Local<Function>      MakeFunction (GIBaseInfo *base_info);
MaybeLocal<Function> MakeVirtualFunction(GIBaseInfo *info, GType implementor);

};
