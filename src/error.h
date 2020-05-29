
#pragma once

#include <nan.h>
#include <node.h>
#include <girepository.h>

#include "gi.h"

using v8::Function;
using v8::Local;
using v8::MaybeLocal;
using v8::String;
using Nan::FunctionCallbackInfo;
using Nan::WeakCallbackInfo;

namespace GNodeJS {

  namespace Throw {

    void GError(const char* domain, GError* error);

    void NotEnoughArguments (int expected, int actual);

    void InvalidType (GIArgInfo *info, GITypeInfo *type_info, Local<Value> value);

    void UnhandledType (const char *typeName);

    void InvalidReturnValue (GITypeInfo *type_info, Local<Value> value);

    void UnsupportedCallback (GIBaseInfo* info);

    void InvalidGType (GType gtype);

    void CannotConvertGType (const char *category, GType gtype);

    void GTypeNotFound (GIBaseInfo *info, const char* error);

    void SignalNotFound(GIBaseInfo *object_info, const char* signal_name);

    void InvalidSignal(const char* instance_name, const char* signal_name);

    void InvalidPropertyName (const char *propName);

  }; // namespace Throw

}; // namespace GNodeJS
