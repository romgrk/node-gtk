/*
 * type.h
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

#ifndef TYPE_H
#define TYPE_H

#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::Isolate;
using v8::Value;

namespace GNodeJS {

Local<Function> MakeClass (GIBaseInfo *info);
void            ClassDestroyed (const v8::WeakCallbackInfo<GIBaseInfo> &info);

};

#endif /* !TYPE_H */
