
#include <node.h>
#include <girepository.h>

#include "value.h"
#include "boxed.h"
#include "function.h"
#include "gobject.h"
#include "loop.h"

#include <string.h>

using namespace v8;

static void DefineFunction(Isolate *isolate, Handle<Object> module_obj, GIBaseInfo *info) {
    const char *function_name = g_base_info_get_name ((GIBaseInfo *) info);
    module_obj->Set (String::NewFromUtf8 (isolate, function_name), GNodeJS::MakeFunction (isolate, info));
}

static void DefineFunction(Isolate *isolate, Handle<Object> module_obj, GIBaseInfo *info, const char *base_name) {
    char *function_name = g_strdup_printf ("%s_%s", base_name, g_base_info_get_name ((GIBaseInfo *) info));
    module_obj->Set (String::NewFromUtf8 (isolate, function_name), GNodeJS::MakeFunction (isolate, info));
    g_free (function_name);
}

static void DefineObjectFunctions(Isolate *isolate, Handle<Object> module_obj, GIBaseInfo *info) {
    const char *object_name = g_base_info_get_name ((GIBaseInfo *) info);

    int n_methods = g_object_info_get_n_methods (info);
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *meth_info = g_object_info_get_method (info, i);
        DefineFunction (isolate, module_obj, meth_info, object_name);
        g_base_info_unref ((GIBaseInfo *) meth_info);
    }
}

static void DefineBoxedFunctions(Isolate *isolate, Handle<Object> module_obj, GIBaseInfo *info) {
    const char *object_name = g_base_info_get_name ((GIBaseInfo *) info);

    int n_methods = g_struct_info_get_n_methods (info);
    for (int i = 0; i < n_methods; i++) {
        GIFunctionInfo *meth_info = g_struct_info_get_method (info, i);
        DefineFunction (isolate, module_obj, meth_info, object_name);
        g_base_info_unref ((GIBaseInfo *) meth_info);
    }
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
        DefineBoxedFunctions (isolate, module_obj, info);
        break;
    default:
        break;
    }
}

static void Bootstrap(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate ();

    GIRepository *repo = g_irepository_get_default ();
    GError *error = NULL;

    const char *ns = "GIRepository";
    g_irepository_require (repo, ns, NULL, (GIRepositoryLoadFlags) 0, &error);
    if (error) {
        isolate->ThrowException (Exception::TypeError (String::NewFromUtf8 (isolate, error->message)));
        return;
    }

    Local<Object> module_obj = Object::New (isolate);

    int n = g_irepository_get_n_infos (repo, ns);
    for (int i = 0; i < n; i++) {
        GIBaseInfo *info = g_irepository_get_info (repo, ns, i);
        DefineBootstrapInfo (isolate, module_obj, info);
        g_base_info_unref (info);
    }

    args.GetReturnValue ().Set (module_obj);
}

static void GetConstantValue(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate ();
    GIBaseInfo *info = (GIBaseInfo *) GNodeJS::BoxedFromWrapper (args[0]);
    GITypeInfo *type_info = g_constant_info_get_type ((GIConstantInfo *) info);
    GIArgument garg;
    g_constant_info_get_value ((GIConstantInfo *) info, &garg);
    args.GetReturnValue ().Set (GNodeJS::GIArgumentToV8 (isolate, type_info, &garg));
}

static void MakeFunction(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate ();
    GIBaseInfo *info = (GIBaseInfo *) GNodeJS::BoxedFromWrapper (args[0]);
    args.GetReturnValue ().Set (GNodeJS::MakeFunction (isolate, info));
}

static void MakeClass(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate ();
    GIBaseInfo *info = (GIBaseInfo *) GNodeJS::BoxedFromWrapper (args[0]);
    args.GetReturnValue ().Set (GNodeJS::MakeClass (isolate, info));
}

static void ObjectPropertyGetter(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate ();
    GObject *gobject = GNodeJS::GObjectFromWrapper (args[0]);
    String::Utf8Value prop_name_v (args[1]->ToString ());
    const char *prop_name = *prop_name_v;

    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);
    GValue value = {};
    g_value_init (&value, G_PARAM_SPEC_VALUE_TYPE (pspec));

    g_object_get_property (gobject, prop_name, &value);

    args.GetReturnValue ().Set (GNodeJS::GValueToV8 (isolate, &value));
}

static void ObjectPropertySetter(const FunctionCallbackInfo<Value> &args) {
    GObject *gobject = GNodeJS::GObjectFromWrapper (args[0]);
    String::Utf8Value prop_name_v (args[1]->ToString ());
    const char *prop_name = *prop_name_v;

    GParamSpec *pspec = g_object_class_find_property (G_OBJECT_GET_CLASS (gobject), prop_name);
    GValue value = {};
    g_value_init (&value, G_PARAM_SPEC_VALUE_TYPE (pspec));

    GNodeJS::V8ToGValue (&value, args[2]);

    g_object_set_property (gobject, prop_name, &value);
}

static void StartLoop(const FunctionCallbackInfo<Value> &args) {
    GNodeJS::StartLoop ();
}

void InitModule(Handle<Object> exports, Handle<Value> module, void *priv) {
    Isolate *isolate = Isolate::GetCurrent ();

    /* XXX: This is an ugly collection of random bits and pieces. We should organize
     * this functionality a lot better and clean it up. */
    exports->Set (String::NewFromUtf8 (isolate, "Bootstrap"), FunctionTemplate::New (isolate, Bootstrap)->GetFunction ());
    exports->Set (String::NewFromUtf8 (isolate, "GetConstantValue"), FunctionTemplate::New (isolate, GetConstantValue)->GetFunction ());
    exports->Set (String::NewFromUtf8 (isolate, "MakeFunction"), FunctionTemplate::New (isolate, MakeFunction)->GetFunction ());
    exports->Set (String::NewFromUtf8 (isolate, "MakeClass"), FunctionTemplate::New (isolate, MakeClass)->GetFunction ());
    exports->Set (String::NewFromUtf8 (isolate, "ObjectPropertyGetter"), FunctionTemplate::New (isolate, ObjectPropertyGetter)->GetFunction ());
    exports->Set (String::NewFromUtf8 (isolate, "ObjectPropertySetter"), FunctionTemplate::New (isolate, ObjectPropertySetter)->GetFunction ());
    exports->Set (String::NewFromUtf8 (isolate, "StartLoop"), FunctionTemplate::New (isolate, StartLoop)->GetFunction ());
}

NODE_MODULE(gi, InitModule)
