
#include "function.h"
#include "value.h"
#include "object.h"

using namespace v8;

namespace GNodeJS {

static Handle<Value> FunctionInvoker(const Arguments &args) {
    HandleScope scope;
    GIBaseInfo *info = (GIBaseInfo *) External::Unwrap (args.Data ());
    GIFunctionInfo *function_info = (GIFunctionInfo *) info;
    GError *error = NULL;

    /* XXX: For now, only work on functions without any OUT args at all.
     * Just assume everything is an in arg. */
    int n_in_args = g_callable_info_get_n_args ((GICallableInfo *) info);
    int n_total_args = n_in_args;

    if (args.Length() < n_in_args) {
        ThrowException (Exception::TypeError (String::New ("Not enough arguments.")));
        return scope.Close (Undefined ());
    }

    gboolean is_method = ((g_function_info_get_flags (info) & GI_FUNCTION_IS_METHOD) != 0 &&
                          (g_function_info_get_flags (info) & GI_FUNCTION_IS_CONSTRUCTOR) == 0);
    if (is_method)
        n_total_args++;

    GIArgument total_args[n_total_args];
    GIArgument *in_args;

    if (is_method) {
        total_args[0].v_pointer = GObjectFromWrapper (args.This ());
        in_args = &total_args[1];
    } else {
        in_args = &total_args[0];
    }

    for (int i = 0; i < n_in_args; i++) {
        GIArgInfo *arg_info = g_callable_info_get_arg ((GICallableInfo *) info, i);
        GITypeInfo type_info;
        g_arg_info_load_type (arg_info, &type_info);
        V8ToGIArgument (&type_info, &in_args[i], args[i]);
        g_base_info_unref ((GIBaseInfo *) arg_info);
    }

    GIArgument return_value;
    g_function_info_invoke (function_info,
                            total_args, n_total_args,
                            NULL, 0,
                            &return_value,
                            &error);

    for (int i = 0; i < n_in_args; i++) {
        GIArgInfo *arg_info = g_callable_info_get_arg ((GICallableInfo *) info, i);
        GITypeInfo type_info;
        g_arg_info_load_type (arg_info, &type_info);
        FreeGIArgument (&type_info, &in_args[i]);
        g_base_info_unref ((GIBaseInfo *) arg_info);
    }

    if (error) {
        ThrowException (Exception::TypeError (String::New (error->message)));
        return scope.Close (Undefined ());
    }

    GITypeInfo return_value_type;
    g_callable_info_load_return_type ((GICallableInfo *) info, &return_value_type);
    return scope.Close (GIArgumentToV8 (&return_value_type, &return_value));
}

static void FunctionDestroyed(Persistent<Value> object, void *data) {
    GIBaseInfo *info = (GIBaseInfo *) data;
    g_base_info_unref (info);
}

Handle<Function> MakeFunction(GIBaseInfo *info) {
    Persistent<FunctionTemplate> tpl = Persistent<FunctionTemplate>::New (FunctionTemplate::New (FunctionInvoker, External::Wrap (info)));
    tpl.MakeWeak (g_base_info_ref (info), FunctionDestroyed);
    Local<Function> fn = tpl->GetFunction ();

    const char *function_name = g_base_info_get_name (info);
    fn->SetName (String::NewSymbol (function_name));

    return fn;
}

};
