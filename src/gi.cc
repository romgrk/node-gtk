#include <gobject-introspection-1.0/girepository.h>
#include <node.h>
#include <nan.h>

#include "async_call_environment.h"
#include "boxed.h"
#include "debug.h"
#include "function.h"
#include "gi.h"
#include "gobject.h"
#include "loop.h"
#include "macros.h"
#include "type.h"
#include "util.h"
#include "value.h"
#include "modules/system.h"
#include "modules/cairo/cairo.h"

using namespace v8;
using GNodeJS::BaseInfo;

namespace GNodeJS {

    G_DEFINE_QUARK(gnode_js_object,      object);
    G_DEFINE_QUARK(gnode_js_template,    template);
    G_DEFINE_QUARK(gnode_js_constructor, constructor);
    G_DEFINE_QUARK(gnode_js_function,    function);

    Nan::Persistent<Object> moduleCache(Nan::New<Object>());

    Local<Object> GetModuleCache() {
        return Nan::New<Object>(GNodeJS::moduleCache);
    }
}


static void DefineFunction(Isolate *isolate, Local<Object> module_obj, GIBaseInfo *info) {
    const char *function_name = g_base_info_get_name ((GIBaseInfo *) info);
    Local<Function> fn = GNodeJS::MakeFunction (info);

    Nan::Set(module_obj, UTF8(function_name), fn);
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
    GIBaseInfo *gi_info = (GIBaseInfo *) GNodeJS::PointerFromWrapper (info[0]);
    GITypeInfo *type_info = g_constant_info_get_type(gi_info);

    if (type_info == NULL) {
        info.GetReturnValue().SetNull();
        return;
    }

    GIArgument gi_arg;
    gint size = g_constant_info_get_value(gi_info, &gi_arg);
    GITypeTag type_tag = g_type_info_get_tag(type_info);

    if (size == 0 && type_tag == GI_TYPE_TAG_INTERFACE) {
        /* This is for HarfBuzz.LANGUAGE_INVALID, which is a macro defined
         * as `#define HB_LANGUAGE_INVALID ((hb_language_t) 0)`. A struct
         * with 0 size is invalid and letting it pass triggers a V8 abort
         * when we try to attach through SetAlignedPointerInInternalField. */
        info.GetReturnValue().SetNull();
    }
    else if (size < 0) {
        WARN("Couldn't load %s.%s: invalid constant size: %i",
                g_base_info_get_namespace (gi_info),
                g_base_info_get_name (gi_info),
                size);
    }
    else {
        /* The `length` argument here only applies to arrays. We use it to
         * trick GIArgumentToV8 to think that any array converted here has
         * a length of zero. This is required because some vala-generated
         * introspected libraries produce Array constants, which isn't
         * expected/allowed in GIR. This was observed for
         * Granite.Application.options. */
        auto length = 0;
        info.GetReturnValue().Set(
            GNodeJS::GIArgumentToV8 (type_info, &gi_arg, length));
    }

    g_constant_info_free_value(gi_info, &gi_arg);
    g_base_info_unref(type_info);
}

NAN_METHOD(MakeFunction) {
    BaseInfo gi_info(info[0]);
    Local<Function> fn = GNodeJS::MakeFunction(*gi_info);
    info.GetReturnValue().Set(fn);
}

NAN_METHOD(MakeVirtualFunction) {
    if (info.Length() < 2 || !info[0]->IsObject() || !info[1]->IsNumber()) {
        Nan::ThrowTypeError("Incorrect arguments. Expecting (GIBaseInfo, GType)");
        return;
    }

    BaseInfo gi_info(info[0]);
    GType implementor = (gulong) Nan::To<int64_t> (info[1]).ToChecked();

    MaybeLocal<Function> maybeFn = GNodeJS::MakeVirtualFunction(*gi_info, implementor);

    if (maybeFn.IsEmpty())
        return;

    info.GetReturnValue().Set(maybeFn.ToLocalChecked());
}

NAN_METHOD(MakeObjectClass) {
    BaseInfo gi_info(info[0]);
    auto klass = GNodeJS::MakeClass(*gi_info);
    if (!klass.IsEmpty())
        info.GetReturnValue().Set(klass.ToLocalChecked());
}

NAN_METHOD(MakeBoxedClass) {
    BaseInfo gi_info(info[0]);
    info.GetReturnValue().Set(GNodeJS::MakeBoxedClass(*gi_info));
}

NAN_METHOD(ObjectPropertyGetter) {
    GObject *gobject = GNodeJS::GObjectFromWrapper (info[0]);

    g_assert(gobject != NULL);

    Nan::Utf8String prop_name_v (TO_STRING (info[1]));
    const char *prop_name = *prop_name_v;

    RETURN(GNodeJS::GetGObjectProperty(gobject, prop_name));
}

NAN_METHOD(ObjectPropertySetter) {
    GObject* gobject = GNodeJS::GObjectFromWrapper(info[0]);
    Nan::Utf8String prop_name_v (TO_STRING (info[1]));
    const char *prop_name = *prop_name_v;

    if (gobject == NULL) {
        WARN("ObjectPropertySetter: null GObject; cant get %s", prop_name);
        RETURN(Nan::False());
    }

    RETURN(GNodeJS::SetGObjectProperty(gobject, prop_name, info[2]));
}

NAN_METHOD(StructFieldSetter) {
    Local<Object> boxedWrapper = info[0].As<Object>();
    Local<Object> fieldInfo    = info[1].As<Object>();
    Local<Value>  value        = info[2];

    void        *boxed = GNodeJS::PointerFromWrapper(boxedWrapper);
    GIFieldInfo *field = (GIFieldInfo *) GNodeJS::PointerFromWrapper(fieldInfo);
    GITypeInfo  *field_type = g_field_info_get_type(field);

    g_assert(boxed);
    g_assert(field);
    g_assert(field_type);

    GIArgument arg;

    if (!GNodeJS::V8ToGIArgument(field_type, &arg, value, true)) {
        char *message = g_strdup_printf("Couldn't convert value for field '%s'",
                g_base_info_get_name(field));
        Nan::ThrowTypeError (message);
        g_free(message);

        RETURN (Nan::Undefined());

    } else {

        if (g_field_info_set_field(field, boxed, &arg) == FALSE) {
            Nan::ThrowError("Unable to set field (complex types not allowed)");
            RETURN (Nan::Undefined());
        }

        /*
         * g_field_info_set_field:
         *   This only handles fields of simple C types. It will fail for a field of
         *   a composite type like a nested structure or union even if that is actually
         *   writable. Note also that that it will refuse to write fields where memory
         *   management would by required. A field with a type such as 'char *' must be
         *   set with a setter function.
         * Therefore, no need to free GIArgument.
         */

    }

    g_base_info_unref (field_type);
}

NAN_METHOD(StructFieldGetter) {
    Local<Object> boxedWrapper = info[0].As<Object>();
    Local<Object> fieldInfo    = info[1].As<Object>();

    if (boxedWrapper->InternalFieldCount() == 0) {
        Nan::ThrowError("StructFieldGetter: instance is not a boxed");
        return;
    }

    if (fieldInfo->InternalFieldCount() == 0) {
        Nan::ThrowError("StructFieldGetter: field info is invalid");
        return;
    }

    void        *boxed = GNodeJS::PointerFromWrapper(boxedWrapper);
    GIFieldInfo *field = (GIFieldInfo *) GNodeJS::PointerFromWrapper(fieldInfo);

    if (boxed == NULL) {
        Nan::ThrowError("StructFieldGetter: instance is NULL");
        return;
    }

    if (field == NULL) {
        Nan::ThrowError("StructFieldGetter: field info is NULL");
        return;
    }

    GIArgument value;
    if (!g_field_info_get_field(field, boxed, &value)) {
        Nan::ThrowError("Unable to get field (complex types not allowed)");
        return;
    }

    GITypeInfo  *field_type = g_field_info_get_type(field);
    RETURN(GNodeJS::GIArgumentToV8(field_type, &value));
    g_base_info_unref (field_type);
}

NAN_METHOD(StartLoop) {
    GNodeJS::StartLoop ();
}

NAN_METHOD(GetBaseClass) {
    auto tpl = GNodeJS::GetBaseClassTemplate ();
    auto fn = Nan::GetFunction (tpl).ToLocalChecked();
    info.GetReturnValue().Set(fn);
}

NAN_METHOD(GetTypeSize) {
    GITypeInfo *gi_info = (GITypeInfo *) GNodeJS::PointerFromWrapper (info[0]);
    auto size = GNodeJS::GetTypeSize (gi_info);
    info.GetReturnValue().Set(Nan::New<Number>(size));
}

NAN_METHOD(GetLoopStack) {
    auto stack = GNodeJS::GetLoopStack();
    info.GetReturnValue().Set(stack);
}

NAN_METHOD(GetModuleCache) {
    info.GetReturnValue().Set(Nan::New<Object>(GNodeJS::moduleCache));
}

void InitModule(Local<Object> exports, Local<Value> module, void *priv) {
    GNodeJS::AsyncCallEnvironment::Initialize();

    NAN_EXPORT(exports, Bootstrap);
    NAN_EXPORT(exports, GetModuleCache);
    NAN_EXPORT(exports, GetConstantValue);
    NAN_EXPORT(exports, MakeBoxedClass);
    NAN_EXPORT(exports, MakeObjectClass);
    NAN_EXPORT(exports, MakeFunction);
    NAN_EXPORT(exports, MakeVirtualFunction);
    NAN_EXPORT(exports, StructFieldGetter);
    NAN_EXPORT(exports, StructFieldSetter);
    NAN_EXPORT(exports, ObjectPropertyGetter);
    NAN_EXPORT(exports, ObjectPropertySetter);
    NAN_EXPORT(exports, StartLoop);
    NAN_EXPORT(exports, GetBaseClass);
    NAN_EXPORT(exports, GetTypeSize);
    NAN_EXPORT(exports, GetLoopStack);

    Nan::Set(exports, UTF8("System"), GNodeJS::System::GetModule());
    Nan::Set(exports, UTF8("Cairo"),  GNodeJS::Cairo::GetModule());
}

NODE_MODULE(node_gtk, InitModule)
