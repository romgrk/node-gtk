#include <gobject-introspection-1.0/girepository.h>
#include <node.h>
#include <nan.h>

#include "boxed.h"
#include "debug.h"
#include "function.h"
#include "gi.h"
#include "gobject.h"
#include "loop.h"
#include "util.h"
#include "value.h"

using namespace v8;
using Nan::New;
using Nan::Set;

using GNodeJS::BaseInfo;

static void DefineFunction(Isolate *isolate, Local<Object> module_obj, GIBaseInfo *info) {
    const char *function_name = g_base_info_get_name ((GIBaseInfo *) info);
    Local<Function> fn = GNodeJS::MakeFunction (info);

    module_obj->Set(String::NewFromUtf8(isolate, function_name), fn);
}

static void DefineFunction(Isolate *isolate, Local<Object> module_obj, GIBaseInfo *info, const char *base_name) {
    Local<Function> fn = GNodeJS::MakeFunction (info);

    char *function_name = g_strdup_printf ("%s_%s", base_name, g_base_info_get_name(info));
    Nan::Set(module_obj, UTF8(function_name), fn);
    g_free (function_name);
}

static void DefineObjectFunctions(Isolate *isolate, Local<Object> module_obj, GIBaseInfo *info) {
    const char *object_name = g_base_info_get_name ((GIBaseInfo *) info);

    int n_methods = g_object_info_get_n_methods (info);
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *meth_info = g_object_info_get_method (info, i);
        DefineFunction (isolate, module_obj, meth_info, object_name);
        g_base_info_unref ((GIBaseInfo *) meth_info);
    }
}

static void DefineBoxedFunctions(Isolate *isolate, Local<Object> module_obj, GIBaseInfo *info) {
    const char *object_name = g_base_info_get_name ((GIBaseInfo *) info);

    int n_methods = g_struct_info_get_n_methods (info);
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *meth_info = g_struct_info_get_method (info, i);
        DefineFunction (isolate, module_obj, meth_info, object_name);
        g_base_info_unref ((GIBaseInfo *) meth_info);
    }
}

static void DefineBootstrapInfo(Isolate *isolate, Local<Object> module_obj, GIBaseInfo *info) {
    GIInfoType type = g_base_info_get_type (info);

    switch (type) {
    case GI_INFO_TYPE_FUNCTION:
        DefineFunction (isolate, module_obj, info);
        break;
    case GI_INFO_TYPE_OBJECT:
        DefineObjectFunctions (isolate, module_obj, info);
        break;
    case GI_INFO_TYPE_BOXED:
    case GI_INFO_TYPE_STRUCT:
        DefineBoxedFunctions (isolate, module_obj, info);
        break;
    default:
        break;
    }
}


NAN_METHOD(Bootstrap) {
    Isolate *isolate = info.GetIsolate();

    GIRepository *repo = g_irepository_get_default ();
    GError *error = NULL;

    const char *ns = "GIRepository";
    g_irepository_require (repo, ns, NULL, (GIRepositoryLoadFlags) 0, &error);

    if (error) {
        Nan::ThrowError( error->message );
        return;
    }

    Local<Object> module_obj = Object::New (isolate);

    int n = g_irepository_get_n_infos (repo, ns);
    for (int i = 0; i < n; i++) {
        BaseInfo baseInfo(g_irepository_get_info(repo, ns, i));
        DefineBootstrapInfo(isolate, module_obj, baseInfo.info());
    }

    info.GetReturnValue().Set(module_obj);
}

NAN_METHOD(GetConstantValue) {
    GIBaseInfo *gi_info = (GIBaseInfo *) GNodeJS::BoxedFromWrapper (info[0]);
    GITypeInfo *type = g_constant_info_get_type ((GIConstantInfo *) gi_info);

    if (type == NULL) {
        info.GetReturnValue().SetNull();
        return;
    }

    GIArgument gi_arg;
    g_constant_info_get_value((GIConstantInfo *) gi_info, &gi_arg);
    info.GetReturnValue().Set(GNodeJS::GIArgumentToV8 (type, &gi_arg));
}

NAN_METHOD(MakeFunction) {
    //Isolate *isolate = info.GetIsolate ();
    GIBaseInfo *gi_info = (GIBaseInfo *) GNodeJS::BoxedFromWrapper(info[0]);
    Local<Function> fn = GNodeJS::MakeFunction(gi_info);
    info.GetReturnValue().Set(fn);
}

NAN_METHOD(MakeObjectClass) {
    //Isolate *isolate = info.GetIsolate ();
    Local<Object> obj = info[0].As<Object>();

    if (obj->InternalFieldCount() == 0) {
        Nan::ThrowTypeError("Object is not a GIBaseInfo wrapper");
        return;
    }

    GIBaseInfo *gi_info = static_cast<GIBaseInfo*>(GNodeJS::BoxedFromWrapper (obj));

    info.GetReturnValue().Set(GNodeJS::MakeClass(gi_info));
}

NAN_METHOD(MakeBoxedClass) {
    //Isolate *isolate = info.GetIsolate ();
    BaseInfo gi_info(info[0]);

    info.GetReturnValue().Set(GNodeJS::MakeBoxedClass(*gi_info));
}

NAN_METHOD(ObjectPropertyGetter) {
    GObject *gobject = GNodeJS::GObjectFromWrapper (info[0]);

    g_assert(gobject != NULL);

    String::Utf8Value prop_name_v (info[1]->ToString ());
    const char *prop_name = *prop_name_v;

    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);

    if (pspec == NULL) {
        WARN("ObjectPropertyGetter: no property %s", prop_name);
        return;
    }

    GValue value = {};
    g_value_init (&value, G_PARAM_SPEC_VALUE_TYPE (pspec));
    g_object_get_property (gobject, prop_name, &value);

    RETURN(GNodeJS::GValueToV8(&value));
}

NAN_METHOD(ObjectPropertySetter) {
    GObject *gobject = GNodeJS::GObjectFromWrapper(info[0]);

    g_assert(gobject != NULL);

    String::Utf8Value prop_name_v (info[1]->ToString ());
    const char *prop_name = *prop_name_v;

    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);

    if (pspec == NULL) {
        WARN("ObjectPropertySetter: no property %s", prop_name);
        return;
    }

    GValue value = {};
    g_value_init(&value, G_PARAM_SPEC_VALUE_TYPE (pspec));
    GNodeJS::V8ToGValue (&value, info[2]);

    g_object_set_property (gobject, prop_name, &value);
}

NAN_METHOD(StructFieldSetter) {
    // const Nan::FunctionCallbackInfo<v8::Value>& info

    Local<Object> boxedWrapper = info[0].As<Object>();
    Local<Object> fieldInfo    = info[1].As<Object>();
    Local<Value>  value        = info[2];

    void        *boxed = GNodeJS::BoxedFromWrapper(boxedWrapper);
    GIFieldInfo *field = (GIFieldInfo *) GNodeJS::BoxedFromWrapper(fieldInfo);
    GITypeInfo  *field_type = g_field_info_get_type(field);

    g_assert(boxed);
    g_assert(field);
    g_assert(field_type);

    GIArgument arg;

    if (GNodeJS::V8ToGIArgument(field_type, &arg, value, true)) {

        if (g_field_info_set_field(field, boxed, &arg) == FALSE)
            DEBUG("FieldSetter: couldnt set field %s", g_base_info_get_name(field));

        GNodeJS::FreeGIArgument(field_type, &arg);

    } else {
        DEBUG("FieldSetter: couldnt convert value for field %s", g_base_info_get_name(field));
    }

    g_base_info_unref (field_type);
}

NAN_METHOD(StructFieldGetter) {
    // const Nan::FunctionCallbackInfo<v8::Value>& info
    Local<Object> boxedWrapper = info[0].As<Object>();
    Local<Object> fieldInfo    = info[1].As<Object>();

    if (boxedWrapper->InternalFieldCount() == 0) {
        Nan::ThrowReferenceError("StructFieldGetter: argument 1 is not a boxed.");
        return;
    }

    if (fieldInfo->InternalFieldCount() == 0) {
        g_warning("StructFieldGetter: No internal fields.");
        return;
    }

    void        *boxed = GNodeJS::BoxedFromWrapper(boxedWrapper);
    GIFieldInfo *field = (GIFieldInfo *) GNodeJS::BoxedFromWrapper(fieldInfo);

    if (boxed == NULL) {
        Nan::ThrowError("StructFieldGetter: accessing NULL boxed pointer");
        return;
    }

    if (field == NULL) {
        Nan::ThrowError("FieldGetter: NULL field_info pointer");
        return;
    }

    GIArgument value;
    if (g_field_info_get_field(field, boxed, &value)) {
        GITypeInfo  *field_type = g_field_info_get_type(field);

        RETURN(GNodeJS::GIArgumentToV8(field_type, &value));

        // GNodeJS::FreeGIArgument(field_type, &value);
        g_base_info_unref (field_type);
    } else {
        DEBUG("StructFieldGetter: couldnt get field %s", g_base_info_get_name(field));
        //DEBUG("StructFieldGetter: property name: %s", *Nan::Utf8String(property) );
    }
}

NAN_METHOD(StartLoop) {
    GNodeJS::StartLoop ();
}

NAN_METHOD(WrapperFromBoxed) {
    //Isolate *isolate = info.GetIsolate ();
    GIBaseInfo *gi_info = (GIBaseInfo *) GNodeJS::BoxedFromWrapper (info[0]);
    void *boxed = External::Cast(*info[1])->Value();
    info.GetReturnValue().Set(GNodeJS::WrapperFromBoxed(gi_info, boxed));
}

NAN_METHOD(PointerToString) {
    if (info[0]->ToObject()->InternalFieldCount() == 0) {
        Nan::ThrowReferenceError("Object doesnt have any internal field.");
        return;
    }
    void *boxed = GNodeJS::BoxedFromWrapper(info[0]);
    char *address = g_strdup_printf("%#zx", (unsigned long)boxed);
    info.GetReturnValue().Set(UTF8(address));
    g_free(address);
}

NAN_METHOD(InternalFieldCount) {
    Local<Object> obj = info[0].As<Object>();
    RETURN(obj->InternalFieldCount());
}

void InitModule(Local<Object> exports, Local<Value> module, void *priv) {
    NAN_EXPORT(exports, Bootstrap);
    NAN_EXPORT(exports, GetConstantValue);
    NAN_EXPORT(exports, MakeBoxedClass);
    NAN_EXPORT(exports, MakeObjectClass);
    NAN_EXPORT(exports, MakeFunction);
    NAN_EXPORT(exports, WrapperFromBoxed);
    NAN_EXPORT(exports, StructFieldGetter);
    NAN_EXPORT(exports, StructFieldSetter);
    NAN_EXPORT(exports, ObjectPropertyGetter);
    NAN_EXPORT(exports, ObjectPropertySetter);
    NAN_EXPORT(exports, StartLoop);
    NAN_EXPORT(exports, PointerToString);
    NAN_EXPORT(exports, InternalFieldCount);
}

NODE_MODULE(gi, InitModule)
