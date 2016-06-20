
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

/* void InstallFunction (Local<FunctionTemplate> tpl, GIFunctionInfo *func_info) {
 *     GIFunctionInfoFlags flags = g_function_info_get_flags(func_info);
 *     bool is_method = ((flags & GI_FUNCTION_IS_METHOD) != 0 &&
 *                       (flags & GI_FUNCTION_IS_CONSTRUCTOR) == 0);
 *     char *fn_name = Util::toCamelCase (g_base_info_get_name (func_info));
 *     Local<Function> fn = GNodeJS::MakeFunction (func_info);
 * 
 *     if (is_method)
 *         tpl->PrototypeTemplate()->Set(UTF8(fn_name), fn);
 *     else
 *         tpl->Set(UTF8(fn_name), fn);
 * 
 *     g_free(fn_name);
 * }
 *  */

};
