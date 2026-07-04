#include <girepository.h>
#include <node.h>
#include <nan.h>

#include "async_call_environment.h"
#include "boxed.h"
#include "debug.h"
#include "fundamental.h"
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

    G_DEFINE_QUARK(gnode_js_object,       object);
    G_DEFINE_QUARK(gnode_js_template,     template);
    G_DEFINE_QUARK(gnode_js_constructor,  constructor);
    G_DEFINE_QUARK(gnode_js_function,     function);
    G_DEFINE_QUARK(gnode_js_vfuncs,       vfuncs);
    G_DEFINE_QUARK(gnode_js_dynamic_type, dynamic_type);


    Nan::Persistent<Object> moduleCache(Nan::New<Object>());

    GThread *js_thread = NULL;

    Local<Object> GetModuleCache() {
        return Nan::New<Object>(GNodeJS::moduleCache);
    }

    static Nan::Persistent<v8::Function> typeMaterializer;

    void SetTypeMaterializerInternal(Local<v8::Function> fn) {
        typeMaterializer.Reset(fn);
    }

    void MaterializeType(GIBaseInfo *info) {
        if (typeMaterializer.IsEmpty() || info == NULL)
            return;

        Local<v8::Function> fn = Nan::New<v8::Function>(typeMaterializer);
        Local<Value> argv[] = {
            UTF8(g_base_info_get_namespace(info)),
            UTF8(g_base_info_get_name(info)),
        };
        Nan::TryCatch tryCatch;
        Nan::Call(fn, Nan::GetCurrentContext()->Global(), 2, argv);
        if (tryCatch.HasCaught()) {
            Nan::Utf8String message(tryCatch.Exception());
            g_warning("node-gtk: could not materialize type %s.%s: %s",
                      g_base_info_get_namespace(info),
                      g_base_info_get_name(info),
                      *message);
        }
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

/*
 * Enumerate a loaded namespace's top-level infos in one native call, so that
 * lib/module.js can define lazy accessors without paying ~3 FFI round-trips
 * per info (48ms for Gtk-4.0 + dependencies, vs ~1ms here). Returns a flat
 * array of [name, infoType, index, ...] triplets. Infos that makeInfo() cannot
 * handle (callbacks, gtype structs, etc.) are filtered out here, mirroring the
 * `item !== undefined` check the eager loop used to do.
 */
NAN_METHOD(GetInfoEntries) {
    Nan::Utf8String ns(info[0]);
    GIRepository *repo = g_irepository_get_default();

    int n = g_irepository_get_n_infos(repo, *ns);
    Local<Array> result = Nan::New<Array>();
    uint32_t position = 0;

    for (int i = 0; i < n; i++) {
        BaseInfo baseInfo(g_irepository_get_info(repo, *ns, i));
        GIInfoType type = baseInfo.type();

        switch (type) {
        case GI_INFO_TYPE_FUNCTION:
        case GI_INFO_TYPE_BOXED:
        case GI_INFO_TYPE_ENUM:
        case GI_INFO_TYPE_FLAGS:
        case GI_INFO_TYPE_OBJECT:
        case GI_INFO_TYPE_INTERFACE:
        case GI_INFO_TYPE_CONSTANT:
        case GI_INFO_TYPE_UNION:
            break;
        case GI_INFO_TYPE_STRUCT:
            if (g_struct_info_is_gtype_struct(baseInfo.info()))
                continue;
            break;
        default:
            continue;
        }

        /* Register the GType with the GObject runtime NOW, even though the JS
         * class stays lazy. The eager loop did this as a side effect
         * (MakeObjectClass/MakeBoxedClass call get_g_type() for every class)
         * and code depends on it: by-name lookups such as
         * GObject.typeFromName('GFileInfo') or type names in GtkBuilder XML
         * must resolve without JS ever touching the class. Registration is a
         * few µs per type; class initialization stays lazy either way. */
        switch (type) {
        case GI_INFO_TYPE_STRUCT:
        case GI_INFO_TYPE_BOXED:
        case GI_INFO_TYPE_UNION:
        case GI_INFO_TYPE_OBJECT:
        case GI_INFO_TYPE_INTERFACE:
            g_registered_type_info_get_g_type((GIRegisteredTypeInfo *) baseInfo.info());
            break;
        default:
            break;
        }

        Nan::Set(result, position++, UTF8(baseInfo.name()));
        Nan::Set(result, position++, Nan::New<v8::Int32>(type));
        Nan::Set(result, position++, Nan::New<v8::Int32>(i));
    }

    info.GetReturnValue().Set(result);
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

NAN_METHOD(MakeObjectClass) {
    BaseInfo gi_info(info[0]);
    // Fundamental (non-GObject) types such as GskRenderNode need their own
    // ref/unref-based wrapper rather than the GObject machinery (#468).
    auto klass = GNodeJS::IsFundamentalObjectInfo(*gi_info)
        ? GNodeJS::MakeFundamentalClass(*gi_info)
        : GNodeJS::MakeClass(*gi_info);
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

    auto value = GNodeJS::GetGObjectProperty(gobject, prop_name);
    if (!value.IsEmpty())
        RETURN(value.ToLocalChecked());
}

NAN_METHOD(ObjectPropertySetter) {
    GObject* gobject = GNodeJS::GObjectFromWrapper(info[0]);
    Nan::Utf8String prop_name_v (TO_STRING (info[1]));
    const char *prop_name = *prop_name_v;

    if (gobject == NULL) {
        WARN("ObjectPropertySetter: null GObject; cant get %s", prop_name);
        RETURN(Nan::False());
    }

    auto success = GNodeJS::SetGObjectProperty(gobject, prop_name, info[2]);
    if (!success.IsEmpty())
        RETURN(success.ToLocalChecked());
}

// All members of a C union live at offset 0. Some GLib versions (the
// regression fixed in 2.86.1 — glib#3745) emit a bogus 0xffff offset for union
// field members in the compiled typelib, so g_field_info_get_field /
// g_field_info_set_field would read/write far out of bounds and crash. Detect
// union fields so they can be accessed directly at offset 0 instead (#376).
static bool FieldIsInUnion (GIFieldInfo *field) {
    GIBaseInfo *container = g_base_info_get_container (field);
    return container != NULL
        && g_base_info_get_type (container) == GI_INFO_TYPE_UNION;
}

// Whether a field type is a simple (non-pointer) C value that can be read or
// written by copying its bytes — mirrors what g_field_info_get/set_field
// accept. Pointer-backed types (strings, nested structs, arrays, ...) return
// false and are rejected, as before.
static bool IsSimpleFieldType (GITypeInfo *type_info) {
    switch (g_type_info_get_tag (type_info)) {
        case GI_TYPE_TAG_BOOLEAN:
        case GI_TYPE_TAG_INT8:
        case GI_TYPE_TAG_UINT8:
        case GI_TYPE_TAG_INT16:
        case GI_TYPE_TAG_UINT16:
        case GI_TYPE_TAG_INT32:
        case GI_TYPE_TAG_UINT32:
        case GI_TYPE_TAG_INT64:
        case GI_TYPE_TAG_UINT64:
        case GI_TYPE_TAG_FLOAT:
        case GI_TYPE_TAG_DOUBLE:
        case GI_TYPE_TAG_UNICHAR:
        case GI_TYPE_TAG_GTYPE:
            return true;
        case GI_TYPE_TAG_INTERFACE: {
            GIBaseInfo *iface = g_type_info_get_interface (type_info);
            GIInfoType  itype = g_base_info_get_type (iface);
            bool simple = (itype == GI_INFO_TYPE_ENUM || itype == GI_INFO_TYPE_FLAGS);
            g_base_info_unref (iface);
            return simple;
        }
        default:
            return false;
    }
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

    } else if (FieldIsInUnion(field)) {

        // Union members are at offset 0; write directly to avoid the bogus
        // introspected offset (glib#3745, #376).
        if (IsSimpleFieldType(field_type)) {
            memcpy(boxed, &arg, GNodeJS::GetTypeSize(field_type));
        } else {
            Nan::ThrowError("Unable to set field (complex types not allowed)");
            RETURN (Nan::Undefined());
        }

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
    Local<Object> jsBoxed     = info[0].As<Object>();
    Local<Object> jsFieldInfo = info[1].As<Object>();

    if (jsBoxed->InternalFieldCount() == 0) {
        Nan::ThrowError("StructFieldGetter: instance is not a boxed");
        return;
    }

    if (jsFieldInfo->InternalFieldCount() == 0) {
        Nan::ThrowError("StructFieldGetter: field info is invalid");
        return;
    }

    auto boxed = GNodeJS::PointerFromWrapper(jsBoxed);
    // ref it because the unwrapped ref belongs to the JS wrapper
    BaseInfo fieldInfo =
        g_base_info_ref((GIFieldInfo *) GNodeJS::PointerFromWrapper(jsFieldInfo));

    if (boxed == NULL) {
        Nan::ThrowError("StructFieldGetter: instance is NULL");
        return;
    }

    if (fieldInfo.isEmpty()) {
        Nan::ThrowError("StructFieldGetter: field info is NULL");
        return;
    }

    GIArgument value;
    GNodeJS::ResourceOwnership ownership = GNodeJS::kCopy;
    BaseInfo typeInfo = g_field_info_get_type(*fieldInfo);

    if (FieldIsInUnion(*fieldInfo)) {
        // Union members are at offset 0; read directly to avoid the bogus
        // introspected offset (glib#3745, #376).
        if (!IsSimpleFieldType(*typeInfo)) {
            Nan::ThrowError("Converting non-primitive fields is not allowed");
            return;
        }
        memset(&value, 0, sizeof(value));
        memcpy(&value, boxed, GNodeJS::GetTypeSize(*typeInfo));
        RETURN(GNodeJS::GIArgumentToV8(*typeInfo, &value, -1, ownership));
        return;
    }

    if (!g_field_info_get_field(*fieldInfo, boxed, &value)) {
        /* If g_field_info_get_field() failed, this is a non-primitive type */

        // NOTE: The following lines do work if uncommented, however
        // allowing the user to access substructures is unwise because the
        // intermediary objects don't own their memory and would need to be
        // tracked to ensure their lifetime is linked to the object
        // owning the memory. We will avoid doing that unless required, but
        // ideally libraries should expose accessor methods for introspected
        // languages.

        // auto offset = g_field_info_get_offset(*fieldInfo);
        // auto fieldPtr = G_STRUCT_MEMBER_P(boxed, offset);
        // value.v_pointer = fieldPtr;
        // ownership = kNone;

        Nan::ThrowError("Converting non-primitive fields is not allowed");
        return;
    }

    RETURN(GNodeJS::GIArgumentToV8(*typeInfo, &value, -1, ownership));
}

NAN_METHOD(StartLoop) {
    GNodeJS::StartLoop ();
}

NAN_METHOD(IsRunningMicrotasks) {
    info.GetReturnValue().Set(Nan::New<Boolean>(GNodeJS::IsRunningMicrotasks ()));
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

NAN_METHOD(SetLazyClassRegister) {
    GNodeJS::ObjectClass::SetLazyClassRegister(info);
}

NAN_METHOD(SetInterfaceMethodsApplier) {
    GNodeJS::SetInterfaceMethodsApplier(info);
}

NAN_METHOD(SetTypeMaterializer) {
    GNodeJS::SetTypeMaterializerInternal(info[0].As<v8::Function>());
}

NAN_METHOD(RegisterClass) {
    GNodeJS::ObjectClass::RegisterClass(info);
}

NAN_METHOD(RegisterVFunc) {
    GNodeJS::ObjectClass::RegisterVFunc(info);
}

NAN_METHOD(CallVFunc) {
    GNodeJS::ObjectClass::CallVFunc(info);
}

void InitModule(Local<Object> exports, Local<Value> module, void *priv) {
    GNodeJS::js_thread = g_thread_self();

    GNodeJS::AsyncCallEnvironment::Initialize();

    Nan::Export(exports, "Bootstrap",            Bootstrap);
    Nan::Export(exports, "GetModuleCache",       GetModuleCache);
    Nan::Export(exports, "GetBaseClass",         GetBaseClass);
    Nan::Export(exports, "GetTypeSize",          GetTypeSize);
    Nan::Export(exports, "GetConstantValue",     GetConstantValue);
    Nan::Export(exports, "GetInfoEntries",       GetInfoEntries);
    Nan::Export(exports, "SetTypeMaterializer",  SetTypeMaterializer);
    Nan::Export(exports, "MakeBoxedClass",       MakeBoxedClass);
    Nan::Export(exports, "MakeObjectClass",      MakeObjectClass);
    Nan::Export(exports, "MakeFunction",         MakeFunction);
    Nan::Export(exports, "StructFieldGetter",    StructFieldGetter);
    Nan::Export(exports, "StructFieldSetter",    StructFieldSetter);
    Nan::Export(exports, "ObjectPropertyGetter", ObjectPropertyGetter);
    Nan::Export(exports, "ObjectPropertySetter", ObjectPropertySetter);
    Nan::Export(exports, "StartLoop",            StartLoop);
    Nan::Export(exports, "IsRunningMicrotasks",  IsRunningMicrotasks);
    Nan::Export(exports, "GetLoopStack",         GetLoopStack);
    Nan::Export(exports, "SetLazyClassRegister", SetLazyClassRegister);
    Nan::Export(exports, "SetInterfaceMethodsApplier", SetInterfaceMethodsApplier);
    Nan::Export(exports, "RegisterClass",        RegisterClass);
    Nan::Export(exports, "RegisterVFunc",        RegisterVFunc);
    Nan::Export(exports, "CallVFunc",            CallVFunc);

    Nan::Set(exports, UTF8("System"), GNodeJS::System::GetModule());
    Nan::Set(exports, UTF8("Cairo"),  GNodeJS::Cairo::GetModule());
}

NODE_MODULE(node_gtk, InitModule)
