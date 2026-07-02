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
 * Lazy type materialization: modules are populated with lazy accessors
 * (lib/module.js), and prototypes only get their methods/properties when a
 * class is first touched. Types can also be reached from C first (a method
 * return value, a signal argument): the template-creation paths in
 * gobject.cc/boxed.cc/fundamental.cc call MaterializeType so the JS side
 * decorates the prototype before any wrapper is handed out. The callback is
 * installed from bootstrap.js via SetTypeMaterializer and is idempotent and
 * re-entrancy-safe on the JS side.
 */

void MaterializeType(GIBaseInfo *info);

void SetTypeMaterializerInternal(Local<v8::Function> fn);



/*
 * Quarks for GTypes
 */

GQuark object_quark (void);
GQuark template_quark (void);
GQuark constructor_quark (void);
GQuark function_quark (void);
GQuark vfuncs_quark (void);
GQuark dynamic_type_quark (void);


/*
 * Class for dealing with GIBaseInfo
 */

class BaseInfo {
public:
    GIBaseInfo * _info;

    BaseInfo () : _info(nullptr) { };

    BaseInfo (GIBaseInfo *info) : _info(info) { };

    BaseInfo (Local<Value> value) {
        Local<Object> object = value.As<Object>();
        _info = g_base_info_ref(
            (GIBaseInfo *) GNodeJS::PointerFromWrapper(object));
    };

    ~BaseInfo () {
        this->clear();
    };

    inline BaseInfo& operator= (GIBaseInfo *info) {
        this->clear();
        _info = info;
        return *this;
    }

    inline GIBaseInfo* operator* () {
        return _info;
    }

    inline GIBaseInfo** operator& () {
        return &_info;
    }

    inline GIBaseInfo* info() {
        return _info;
    }

    inline GIBaseInfo* ref() {
        return g_base_info_ref(_info);
    }

    inline void clear() {
        if (_info) {
            g_base_info_unref(_info);
            _info = nullptr;
        }
    }

    inline GIBaseInfo* release() {
        GIBaseInfo *info = _info;
        g_base_info_unref(_info);
        _info = nullptr;
        return info;
    }

    inline bool isEmpty() {
        return _info == nullptr;
    }

    inline GIInfoType type() {
        return g_base_info_get_type(_info);
    }

    inline bool is(GIInfoType infoType) {
        return this->type() == infoType;
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
