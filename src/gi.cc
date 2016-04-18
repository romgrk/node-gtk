#include <girepository.h>
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

using namespace Nan;
using namespace v8;

static void DefineFunction(Isolate *isolate, Handle<Object> module_obj, GIBaseInfo *info) {
    const char *function_name = g_base_info_get_name ((GIBaseInfo *) info);
    const char *function_symbol = g_function_info_get_symbol ((GIFunctionInfo *) info);
    Local<Function> fn = GNodeJS::MakeFunction (isolate, info);

    GIBaseInfo *infoInfo = g_irepository_find_by_name(NULL, "GIRepository", "BaseInfo");

    fn->Set(UTF8("__info"), GNodeJS::WrapperFromBoxed(isolate, infoInfo, info));
    fn->Set(UTF8("__symbol"), UTF8(function_symbol));
    module_obj->Set(String::NewFromUtf8(isolate, function_name), fn);

    g_base_info_unref(infoInfo);
    //g_base_info_unref(function_container);
}

static void DefineFunction(Isolate *isolate, Handle<Object> module_obj, GIBaseInfo *info, const char *base_name) {
    char *function_name = g_strdup_printf ("%s_%s", base_name, g_base_info_get_name ((GIBaseInfo *) info));
    const char *function_symbol = g_function_info_get_symbol ((GIFunctionInfo *) info);
    //GIBaseInfo *function_container = g_base_info_get_container ((GIBaseInfo *) info);
    //const char *container_name = g_base_info_get_name ((GIBaseInfo *) function_container);
    Local<Function> fn = GNodeJS::MakeFunction (isolate, info);

    GIBaseInfo *infoInfo = g_irepository_find_by_name(NULL, "GIRepository", "BaseInfo");

    fn->SetHiddenValue(UTF8("__info"), GNodeJS::WrapperFromBoxed(isolate, infoInfo, info) );
    fn->SetHiddenValue(UTF8("__symbol"), UTF8(function_symbol));
    //Nan::Set(fn, UTF8("__container"), UTF8(container_name));
    //Nan::Set(fn, UTF8("__containerInfo"), GNodeJS::WrapperFromBoxed(isolate, infoInfo, function_container));
    module_obj->Set (String::NewFromUtf8 (isolate, function_name), fn);

    g_base_info_unref(infoInfo);
    //g_base_info_unref(function_container);
    g_free (function_name);
}

static void DefineObjectFunctions(Isolate *isolate, Handle<Object> module_obj, GIBaseInfo *info) {
    const char *object_name = g_base_info_get_name ((GIBaseInfo *) info);
    DEBUG("DefineObjectFunctions: %s", object_name);

    int n_methods = g_object_info_get_n_methods (info);
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *meth_info = g_object_info_get_method (info, i);
        DefineFunction (isolate, module_obj, meth_info, object_name);
        g_base_info_unref ((GIBaseInfo *) meth_info);
    }
}

static void DefineBoxedFunctions(Isolate *isolate, Handle<Object> module_obj, GIBaseInfo *info) {
    const char *object_name = g_base_info_get_name ((GIBaseInfo *) info);
    DEBUG("DefineBoxedFunctions: %s", object_name);

    int n_methods = g_struct_info_get_n_methods (info);
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *meth_info = g_struct_info_get_method (info, i);
        DefineFunction (isolate, module_obj, meth_info, object_name);
        g_base_info_unref ((GIBaseInfo *) meth_info);
    }
}

static void DefineConstant (Isolate *isolate, Handle<Object> module_obj, GIBaseInfo *gi_info) {
    GIBaseInfo *gi_container = g_base_info_get_container(gi_info);
    g_assert(gi_container != NULL);
    const char* container_name = g_base_info_get_name(gi_container);
    char *const_name = g_strdup_printf ("%s_%s", container_name, g_base_info_get_name(gi_info));
    GITypeInfo *type = g_constant_info_get_type ((GIConstantInfo *) gi_info);
    GIArgument garg;
    g_constant_info_get_value ((GIConstantInfo *) gi_info, &garg);
    module_obj->Set(UTF8(const_name), GNodeJS::GIArgumentToV8 (isolate, type, &garg));
    g_free(const_name);
}

static void DefineBootstrapInfo(Isolate *isolate, Handle<Object> module_obj, GIBaseInfo *info) {
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
    case GI_INFO_TYPE_UNION:
        DefineBoxedFunctions (isolate, module_obj, info);
        break;
    default:
        DEBUG("DefineBootstrapInfo: skipping %s", g_base_info_get_name ((GIBaseInfo *) info));
        break;
    }
}


NAN_METHOD(print) {
    GIBaseInfo *gi_info = (GIBaseInfo *) GNodeJS::BoxedFromWrapper(info[0]);
    if (gi_info)
        GNodeJS::print_info(gi_info);
}

NAN_METHOD(toCamelCase) {
    Isolate *isolate = info.GetIsolate();
    Local<String> name = Local<String>::Cast(info[0]);

    char *data = *Nan::Utf8String(name);
    gchar *result = Util::toCamelCase(data);

    info.GetReturnValue().Set(
        UTF8(result) );

    g_free(result);
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
        GIBaseInfo *gi_info = g_irepository_get_info (repo, ns, i);
        DefineBootstrapInfo (isolate, module_obj, gi_info);
        g_base_info_unref (gi_info);
    }

    info.GetReturnValue().Set(module_obj);
}

NAN_METHOD(GetConstantValue) {
    Isolate *isolate = info.GetIsolate();
    GIBaseInfo *gi_info = (GIBaseInfo *) GNodeJS::BoxedFromWrapper (info[0]);
    GITypeInfo *type = g_constant_info_get_type ((GIConstantInfo *) gi_info);
    GIArgument garg;
    g_constant_info_get_value ((GIConstantInfo *) gi_info, &garg);
    info.GetReturnValue().Set (GNodeJS::GIArgumentToV8 (isolate, type, &garg));
}

NAN_METHOD(MakeFunction) {
    Isolate *isolate = info.GetIsolate ();
    GIBaseInfo *gi_info = (GIBaseInfo *) GNodeJS::BoxedFromWrapper(info[0]);

    info.GetReturnValue().Set(GNodeJS::MakeFunction (isolate, gi_info));
}

NAN_METHOD(MakeBoxed) {
    Isolate *isolate = info.GetIsolate ();
    GIBaseInfo *gi_info = (GIBaseInfo *) GNodeJS::BoxedFromWrapper (info[0]);

    info.GetReturnValue().Set(GNodeJS::MakeBoxed(isolate, gi_info));
}

NAN_METHOD(MakeClass) {
    Isolate *isolate = info.GetIsolate ();
    GIBaseInfo *gi_info = (GIBaseInfo *) GNodeJS::BoxedFromWrapper (info[0]);

    info.GetReturnValue().Set(GNodeJS::MakeClass(isolate, gi_info));
}

NAN_METHOD(ObjectPropertyGetter) {
    Isolate *isolate = info.GetIsolate ();
    GObject *gobject = GNodeJS::GObjectFromWrapper (info[0]);
    String::Utf8Value prop_name_v (info[1]->ToString ());
    const char *prop_name = *prop_name_v;

    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);
    GValue value = {};
    g_value_init (&value, G_PARAM_SPEC_VALUE_TYPE (pspec));

    g_object_get_property (gobject, prop_name, &value);

    info.GetReturnValue().Set(GNodeJS::GValueToV8 (isolate, &value));
}

NAN_METHOD(ObjectPropertySetter) {
    GObject *gobject = GNodeJS::GObjectFromWrapper(info[0]);
    String::Utf8Value prop_name_v (info[1]->ToString ());
    const char *prop_name = *prop_name_v;

    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);
    GValue value = {};
    g_value_init (&value, G_PARAM_SPEC_VALUE_TYPE (pspec));

    GNodeJS::V8ToGValue (&value, info[2]);

    g_object_set_property (gobject, prop_name, &value);
}

NAN_METHOD(StartLoop) {
    GNodeJS::StartLoop ();
}

void InitModule(Handle<Object> exports, Handle<Value> module, void *priv) {
    NAN_EXPORT(exports, Bootstrap);
    NAN_EXPORT(exports, toCamelCase);
    NAN_EXPORT(exports, print);
    NAN_EXPORT(exports, GetConstantValue);
    NAN_EXPORT(exports, MakeClass);
    NAN_EXPORT(exports, MakeBoxed);
    NAN_EXPORT(exports, MakeFunction);
    NAN_EXPORT(exports, ObjectPropertyGetter);
    NAN_EXPORT(exports, ObjectPropertySetter);
    NAN_EXPORT(exports, StartLoop);
}

NODE_MODULE(gi, InitModule)

