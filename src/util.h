/*
 * util.h
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>

/*
 * V8 Helpers
 */

#define UTF8(s)         Nan::New<v8::String> (s).ToLocalChecked()
#define RETURN(s)       info.GetReturnValue().Set(s)

#define NOT_A_GTYPE ((GType) -1)

#define GET_OBJECT_GTYPE(target) (GType) Nan::To<int64_t>(Nan::Get(target, UTF8("__gtype__")).ToLocalChecked()).ToChecked()
#define SET_OBJECT_GTYPE(target, value) \
    Nan::DefineOwnProperty(target, \
            UTF8("__gtype__"), \
            Nan::New<Number>(value), \
            (v8::PropertyAttribute)(v8::PropertyAttribute::ReadOnly | v8::PropertyAttribute::DontEnum) \
    )


#define SET_METHOD(object, name)        Nan::SetMethod(object, #name, name)
#define SET_PROTOTYPE_METHOD(tpl, name) Nan::SetPrototypeMethod(tpl, #name, name)

inline void SetProtoAccessor(
        v8::Local<v8::ObjectTemplate> tpl,
        v8::Local<v8::String> name,
        Nan::GetterCallback getter,
        Nan::SetterCallback setter,
        v8::Local<v8::FunctionTemplate> ctor
        ) {
    Nan::SetAccessor(
            tpl,
            name,
            getter,
            setter,
            v8::Local<v8::Value>(),
            v8::DEFAULT,
            v8::None,
            v8::AccessorSignature::New(v8::Isolate::GetCurrent(), ctor)
            );
}

namespace Util
{

    const char*    ArrayTypeToString (GIArrayType array_type);

    char*          GetSignalName(const char* signal_detail);

    char*          ToDashed(const char* camel_case);

} /* Util */
