
#include <girepository.h>
#include <glib.h>

#include "boxed.h"
#include "debug.h"
#include "function.h"
#include "gi.h"
#include "gobject.h"
#include "type.h"
#include "util.h"
#include "value.h"

using v8::Array;
using v8::External;
using v8::Function;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::String;
using v8::Persistent;
using Nan::New;
using Nan::WeakCallbackType;

namespace GNodeJS {


size_t Boxed::GetSize (GIBaseInfo *boxed_info) {
    GIInfoType i_type = g_base_info_get_type(boxed_info);
    if (i_type == GI_INFO_TYPE_STRUCT) {
        return g_struct_info_get_size((GIStructInfo*)boxed_info);
    } else if (i_type == GI_INFO_TYPE_UNION) {
        return g_union_info_get_size((GIUnionInfo*)boxed_info);
    } else {
        g_assert_not_reached();
    }
}


static void BoxedDestroyed(const Nan::WeakCallbackInfo<Boxed> &info);

static void BoxedConstructor(const Nan::FunctionCallbackInfo<Value> &args) {
    /* See gobject.cc for how this works */
    if (!args.IsConstructCall ()) {
        Nan::ThrowTypeError("Not a construct call");
        return;
    }

    void *boxed = NULL;
    unsigned long size = 0;

    Local<Object> self = args.This ();
    GIBaseInfo *gi_info = (GIBaseInfo *) External::Cast (*args.Data ())->Value ();

    if (args[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromBoxed is called. */

        boxed = External::Cast(*args[0])->Value();
        self->SetAlignedPointerInInternalField (0, boxed);

    } else {
        /* User code calling `new Pango.AttrList()` */

        size = Boxed::GetSize(gi_info);
        boxed = g_slice_alloc0(size);
        self->SetAlignedPointerInInternalField (0, boxed);

        if (size == 0) {
            g_warning("Boxed: %s: requested size is 0", g_base_info_get_name(gi_info));
        } else if (!boxed) {
            g_warning("Boxed: %s: allocation returned NULL", g_base_info_get_name(gi_info));
        }
    }

    Nan::DefineOwnProperty(self,
            Nan::New<String>("__gtype__").ToLocalChecked(),
            Nan::New<Number>(g_registered_type_info_get_g_type(gi_info)),
            (v8::PropertyAttribute)(v8::PropertyAttribute::ReadOnly | v8::PropertyAttribute::DontEnum)
    );

    auto* cont = new Boxed();
    cont->data = boxed;
    cont->size = size;
    cont->g_type = g_registered_type_info_get_g_type(gi_info);
    cont->persistent = new Nan::Persistent<Object>(self);
    cont->persistent->SetWeak(cont, BoxedDestroyed, Nan::WeakCallbackType::kParameter);
}

static void BoxedDestroyed(const Nan::WeakCallbackInfo<Boxed> &info) {
    Boxed *box = info.GetParameter();

    if (G_TYPE_IS_BOXED(box->g_type)) {
        g_boxed_free(box->g_type, box->data);
    }
    else if (box->size != 0) {
        // Allocated in ./function.cc @ AllocateArgument
        g_slice_free1(box->size, box->data);
    }

    delete box->persistent;
    delete box;
}


Local<FunctionTemplate> GetBoxedTemplate(GIBaseInfo *info, GType gtype) {
    void *data = NULL;

    if (gtype != G_TYPE_NONE)
        data = g_type_get_qdata(gtype, GNodeJS::template_quark());

    // Template already created
    if (data) {
        Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) data;
        Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate> (*persistent);
        return tpl;
    }

    // Template not created yet

    auto tpl = New<FunctionTemplate>(BoxedConstructor, New<External>(info));
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    if (gtype != G_TYPE_NONE) {
        const char *class_name = g_type_name(gtype);
        tpl->SetClassName( UTF8(class_name) );
        tpl->Set(UTF8("gtype"), Nan::New<Number>(gtype));
    } else {
        const char *class_name = g_base_info_get_name (info);
        tpl->SetClassName( UTF8(class_name) );
    }

    if (gtype == G_TYPE_NONE)
        return tpl;

    Isolate *isolate = Isolate::GetCurrent();
    auto *persistent = new v8::Persistent<FunctionTemplate>(isolate, tpl);
    persistent->SetWeak(
            g_base_info_ref(info),
            GNodeJS::ClassDestroyed,
            WeakCallbackType::kParameter);

    g_type_set_qdata(gtype, GNodeJS::template_quark(), persistent);

    return tpl;
}

static Local<FunctionTemplate> GetBoxedTemplateFromGI(GIBaseInfo *info) {
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) info);
    if (gtype == G_TYPE_NONE) {
        /* g_warning("GetBoxedTemplateFromGI: gtype == G_TYPE_NONE for %s",
         *         g_base_info_get_name(info)); */
    } else {
        g_type_ensure(gtype);
    }
    return GetBoxedTemplate (info, gtype);
}

Local<Function> MakeBoxedClass(GIBaseInfo *info) {
    Local<FunctionTemplate> tpl = GetBoxedTemplateFromGI (info);
    return tpl->GetFunction ();
}

Local<Value> WrapperFromBoxed(GIBaseInfo *info, void *data) {
    if (data == NULL)
        return Nan::Null();

    Local<Function> constructor = MakeBoxedClass (info);

    Local<Value> boxed_external = Nan::New<External> (data);
    Local<Value> args[] = { boxed_external };
    Local<Object> obj = Nan::NewInstance(constructor, 1, args).ToLocalChecked();
    return obj;
}

void* BoxedFromWrapper(Local<Value> value) {
    Local<Object> object = value->ToObject ();
    g_assert(object->InternalFieldCount() > 0);
    void *boxed = object->GetAlignedPointerFromInternalField(0);
    return boxed;
}

};
