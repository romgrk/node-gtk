#ifndef GI_H
#define GI_H

#pragma once

#include <node.h>
#include <nan.h>
#include <girepository.h>
#include "boxed.h"
#include "util.h"


using v8::Object;
using v8::Local;
using v8::Value;


namespace GNodeJS {


/*
 * Object containing all modules loaded
 */

extern Nan::Persistent<Object> moduleCache;

Local<Object> GetModuleCache();



/*
 * Quarks for GTypes
 */

GQuark object_quark (void);
GQuark template_quark (void);
GQuark constructor_quark (void);
GQuark function_quark (void);


/*
 * Class for dealing with GIBaseInfo
 */

class BaseInfo {
public:
    GIBaseInfo * _info;

    BaseInfo (GIBaseInfo *info) : _info(info) { };
    BaseInfo (Local<Value> value) {
        Local<Object> object = value.As<Object>();
        _info = g_base_info_ref(
                (GIBaseInfo *) GNodeJS::PointerFromWrapper(object));
    };
    ~BaseInfo () {
        g_base_info_unref(_info);
    };

    inline GIBaseInfo * operator* () {
        return _info;
    }

    inline GIBaseInfo * info() {
        return _info;
    }

    inline GIInfoType type() {
        return g_base_info_get_type(_info);
    }

    inline GITypeTag tag() {
        return g_type_info_get_tag(_info);
    }

    inline const char* name() {
        return g_base_info_get_name(_info);
    }

    inline const char* ns() {
        return g_base_info_get_namespace(_info);
    }
};

} /*  GNodeJS  */

#endif
