#ifndef GI_H
#define GI_H
#include <node.h>
#include <nan.h>
#include <girepository.h>
#include "boxed.h"

#define N(type, prop, inst)   g_##type##_info_get_n_##prop (inst)

#define UTF8(s)         Nan::New<v8::String> (s).ToLocalChecked()
#define STRING(s)       Nan::New<v8::String> (s).ToLocalChecked()

#define RETURN(s)       info.GetReturnValue().Set(s)

namespace  GNodeJS {

class BaseInfo {
public:
    BaseInfo (GIBaseInfo *info) : _info(info) { };
    BaseInfo (v8::Local<v8::Object> object) {
        _info = g_base_info_ref(
                (GIBaseInfo *)GNodeJS::BoxedFromWrapper(object));
    };
    ~BaseInfo () {
        g_base_info_unref(_info);
    };

    GIBaseInfo * info() {
        return _info;
    }

    inline GIInfoType type() {
        return g_base_info_get_type(_info);
    }

    inline const char* name() {
        return g_base_info_get_name(_info);
    }

    inline const char* ns() {
        return g_base_info_get_namespace(_info);
    }
private:
    GIBaseInfo * _info;
};

} /*  GNodeJS  */

#endif
