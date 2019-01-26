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

} /* Util */
