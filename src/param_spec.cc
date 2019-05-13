/*
 * param_spec.cc
 * Copyright (C) 2018 rgregoir <rgregoir@laurier>
 *
 * Distributed under terms of the MIT license.
 */

#include <string.h>

#include "param_spec.h"
#include "macros.h"

using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using Nan::Persistent;
using Nan::New;
using Nan::FunctionCallbackInfo;
using Nan::WeakCallbackType;

namespace GNodeJS {

Persistent<Function> ParamSpec::instance_constructor;

ParamSpec::~ParamSpec() {
    if (this->data != nullptr) {
        g_param_spec_unref(this->data);
    }
}

Local<Function> ParamSpec::GetConstructor() {
    if (ParamSpec::instance_constructor.IsEmpty()) {
        auto tpl = Nan::New<FunctionTemplate>();
        tpl->SetClassName(Nan::New("GParam").ToLocalChecked());
        tpl->InstanceTemplate()->SetInternalFieldCount(1);

        ParamSpec::instance_constructor.Reset(Nan::GetFunction(tpl).ToLocalChecked());
    }
    return Nan::New(ParamSpec::instance_constructor);
}

Local<Value> ParamSpec::FromGParamSpec(GParamSpec *param_spec, bool makeCopy) {
    if (param_spec == NULL)
        return Nan::Null();

    g_assert(G_IS_PARAM_SPEC(param_spec));

    ParamSpec *paramSpec = new ParamSpec();
    paramSpec->data = makeCopy ? g_param_spec_ref(param_spec) : param_spec;

    Local<Object> instance = Nan::NewInstance(ParamSpec::GetConstructor()).ToLocalChecked();
    Nan::DefineOwnProperty(instance,
            Nan::New("__gtype__").ToLocalChecked(),
            Nan::New<Number> (G_PARAM_SPEC_TYPE (param_spec)),
            (v8::PropertyAttribute)(v8::PropertyAttribute::ReadOnly | v8::PropertyAttribute::DontEnum));
    paramSpec->Wrap(instance);
    return instance;
}

GParamSpec* ParamSpec::FromWrapper(Local<Value> value) {
    ParamSpec* paramSpec = ObjectWrap::Unwrap<ParamSpec>(TO_OBJECT (value));
    return paramSpec->data;
}


};
