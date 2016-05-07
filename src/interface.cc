
#include "boxed.h"
#include "debug.h"
#include "function.h"
#include "gi.h"
#include "gobject.h"
#include "interface.h"
#include "util.h"
#include "value.h"

using namespace v8;
using namespace v8;

namespace GNodeJS {


void InterfaceConstructor(const FunctionCallbackInfo<Value> &info) {

}

Local<FunctionTemplate> GetInterfaceTemplate(Isolate *isolate, GIInterfaceInfo *info) {
    assert(info != NULL);
    // void  *data = g_type_get_qdata (gtype, gnode_js_template_quark ());

    const char* class_name = g_registered_type_info_get_type_name(info);
    Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, InterfaceContructor, External::New(isolate, info));
    tpl->SetClassName(UTF8(class_name));
    tpl->InstanceTemplate()->SetInternalFieldCount(0);

    // uint n_prerequisites = g_interface_info_get_n_prerequisites(info);

    return tpl;
}

};
