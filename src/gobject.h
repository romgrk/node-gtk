
#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include <glib-object.h>

using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::MaybeLocal;
using v8::Isolate;
using v8::Value;

namespace GNodeJS {

MaybeLocal<Function>    MakeClass            (GIBaseInfo *info);
Local<Value>            WrapperFromGObject   (GObject *object);
GObject *               GObjectFromWrapper   (Local<Value> value);

/* Reconcile the wrapper's V8 persistent (weak or strong) with the GObject's
 * current refcount. Main thread only; called inline by ToggleNotify on the JS
 * thread and by toggleQueue's drain for deferred off-thread notifications. */
void                    SynchronizeToggleState (GObject *gobject);
Local<Value>            GetSignalHandler     (GObject *gobject, guint index);
Local<FunctionTemplate> GetBaseClassTemplate ();
MaybeLocal<Value>       GetGObjectProperty   (GObject * gobject, const char *prop_name);
MaybeLocal<v8::Boolean> SetGObjectProperty   (GObject * gobject, const char *prop_name, Local<Value> value);

NAN_METHOD(SetInterfaceMethodsApplier);

namespace ObjectClass {

NAN_METHOD(SetLazyClassRegister);
NAN_METHOD(RegisterClass);
NAN_METHOD(RegisterVFunc);
NAN_METHOD(CallVFunc);

};

};
