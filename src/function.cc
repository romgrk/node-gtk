
#include <string.h>
#include <girffi.h>

#include "boxed.h"
#include "debug.h"
#include "function.h"
#include "gobject.h"
#include "type.h"
#include "value.h"

using namespace v8;
using Nan::New;
using Nan::WeakCallbackType;

namespace GNodeJS {

static void FillArgument(GIArgInfo *arg_info, GIArgument *argument, Local<Value> value) {
    GITypeInfo type_info;
    bool may_be_null = g_arg_info_may_be_null (arg_info);
    g_arg_info_load_type (arg_info, &type_info);
    V8ToGIArgument(&type_info, argument, value, may_be_null);
}

static int GetV8ArrayLength (Local<Value> value) {
    if (value->IsArray())
        return Local<Array>::Cast (value->ToObject ())->Length();
    else if (value->IsString())
        return Local<String>::Cast (value->ToObject ())->Length();
    else if (value->IsNull() || value->IsUndefined())
        return 0;

    printf("%s\n", *Nan::Utf8String(value->ToString()));
    g_assert_not_reached();
}

static void* AllocateArgument (GIBaseInfo *arg_info) {
    GITypeInfo arg_type;
    GIBaseInfo *base_info;
    size_t size;
    void* pointer;

    g_arg_info_load_type(arg_info, &arg_type);
    GITypeTag a_tag = g_type_info_get_tag(&arg_type);

    g_assert(a_tag == GI_TYPE_TAG_INTERFACE);

    base_info = g_type_info_get_interface (&arg_type);
    size = Boxed::GetSize (base_info);
    pointer = g_slice_alloc0 (size);

    g_base_info_unref(base_info);
    return pointer;
}

static void ThrowNotEnoughArguments (int expected, int actual) {
    char *msg = g_strdup_printf(
        "Not enough arguments; expected %i, have %i",
        expected, actual);
    Nan::ThrowTypeError(msg);
    g_free(msg);
}

static void ThrowInvalidType (GIArgInfo *info, GITypeInfo *type_info, Local<Value> value) {
    char *expected = GetTypeName (type_info);
    char *msg = g_strdup_printf(
        "Expected argument of type %s for parameter %s, got '%s'",
        expected,
        g_base_info_get_name(info),
        *Nan::Utf8String(Nan::ToDetailString(value).ToLocalChecked()));
    Nan::ThrowTypeError(msg);
    g_free(expected);
    g_free(msg);
}

static bool IsMethod (GIBaseInfo *info) {
    auto flags = g_function_info_get_flags (info);
    return ((flags & GI_FUNCTION_IS_METHOD) != 0 &&
            (flags & GI_FUNCTION_IS_CONSTRUCTOR) == 0);
}

#define IS_OUT(direction) (direction == GI_DIRECTION_OUT || \
                           direction == GI_DIRECTION_INOUT)
#define IS_IN(direction) (direction == GI_DIRECTION_IN || \
                          direction == GI_DIRECTION_INOUT)
#define IS_INOUT(direction) (direction == GI_DIRECTION_INOUT)

/* see: /home/romgrk/src/gjs/gi/function.cpp */
void FunctionInvoker(const Nan::FunctionCallbackInfo<Value> &info) {

    FunctionInfo *func = (FunctionInfo *) External::Cast (*info.Data ())->Value ();
    GIBaseInfo *gi_info = func->info; // do-not-free

    bool debug_mode = strcmp(g_base_info_get_name(gi_info), "init") == 0;

    if (debug_mode)
        print_callable_info(gi_info);

    bool is_method = IsMethod(gi_info);
    bool can_throw = g_callable_info_can_throw_gerror (gi_info);

    int n_callable_args = g_callable_info_get_n_args (gi_info);
    int n_total_args = n_callable_args;
    int n_out_args = 0;
    int n_in_args = 0;

    if (is_method)
        n_total_args++;

    if (can_throw)
        n_total_args++;

    Parameter call_parameters[n_callable_args];

    /*
     * First, load parameter types and count IN-arguments
     */
    for (int i = 0; i < n_callable_args; i++) {
        GIArgInfo arg_info;
        GITypeInfo type_info;
        g_callable_info_load_arg ((GICallableInfo *) gi_info, i, &arg_info);
        g_arg_info_load_type (&arg_info, &type_info);

        call_parameters[i].direction = g_arg_info_get_direction (&arg_info);

        if (debug_mode) {
            auto typeName = GetTypeName(&type_info);
            printf("%s: %s%s\n",
                    g_base_info_get_name(&arg_info),
                    g_type_info_is_pointer(&type_info) ? "*" : "",
                    typeName);
            free(typeName);
        }

        // If there is an array length, this is an array
        int length_i = g_type_info_get_array_length (&type_info);
        if (length_i >= 0) {
            call_parameters[i].type            = Parameter::ARRAY;
            call_parameters[length_i].type = Parameter::SKIP;

            // If array length came before, we need to remove it from the in_args count
            if (IS_IN(call_parameters[i].direction) && length_i < i) {
                n_in_args--;
            }
        }

        if (call_parameters[i].type != Parameter::SKIP)
            continue;

        if (IS_IN(call_parameters[i].direction)) {
            n_in_args++;
        }
    }

    if (info.Length() < n_in_args) {
        ThrowNotEnoughArguments(n_in_args, info.Length());
        return;
    }


    /*
     * Second, type check every IN-argument
     */
    if (is_method) {
/*         GIArgInfo arg_info;
 *         g_callable_info_load_arg (gi_info, 0, &arg_info);
 *         GITypeInfo type_info;
 *         g_arg_info_load_type (&arg_info, &type_info);
 * 
 *         if (!CanConvertV8ToGIArgument(&type_info, info.This(), false)) {
 *             ThrowInvalidType(&arg_info, &type_info, info.This());
 *             return;
 *         } */
    }
    for (int in_arg = 0, i = 0; i < n_callable_args; i++) {
        Parameter param = call_parameters[i];

        if (param.type == Parameter::SKIP)
            continue;

        GIArgInfo arg_info;
        g_callable_info_load_arg (gi_info, i, &arg_info);
        GIDirection direction = g_arg_info_get_direction (&arg_info);

        if (direction == GI_DIRECTION_IN || direction == GI_DIRECTION_INOUT) {
            GITypeInfo type_info;
            g_arg_info_load_type (&arg_info, &type_info);
            bool may_be_null = g_arg_info_may_be_null (&arg_info);

            if (!CanConvertV8ToGIArgument(&type_info, info[in_arg], may_be_null)) {
                printf("i: %i, in_arg: %i, n_callable_args: %i \n",
                        i, in_arg, n_callable_args);
                for (int j = 0; j < n_callable_args; j++) {
                    Parameter param = call_parameters[i];
                    printf("%i: %s\n",
                            j,
                            param.type == Parameter::NORMAL ? "normal" :
                            (param.type == Parameter::SKIP ? "skip" : "array"));
                }
                print_callable_info(gi_info);
                ThrowInvalidType(&arg_info, &type_info, info[in_arg]);
                return;
            }
            // printf("%s ok\n", g_base_info_get_name(&arg_info));
            in_arg++;
        }
        else {
            // printf("%s is OUT\n", g_base_info_get_name(&arg_info));
        }
    }


    /*
     * Third, add arguments for the instance if it's a method,
     * and for error, if it can throw
     */

    GIArgument total_arg_values[n_total_args];
    GIArgument *callable_arg_values;
    GError *error = nullptr;

    if (is_method) {
        GIBaseInfo *container = g_base_info_get_container (gi_info);
        V8ToGIArgument(container, &total_arg_values[0], info.This());
        callable_arg_values = &total_arg_values[1];
    } else {
        callable_arg_values = &total_arg_values[0];
    }


    /*
     * Fourth, allocate OUT-arguments and fill IN-arguments
     */

    int in_arg = 0,
        i = 0;
    for (; i < n_callable_args; i++) {
        Parameter param = call_parameters[i];

        if (param.type == Parameter::SKIP)
            continue;

        GIArgInfo arg_info;
        GITypeInfo type_info;
        g_callable_info_load_arg (gi_info, i, &arg_info);
        GIDirection direction = g_arg_info_get_direction (&arg_info);

        if (direction == GI_DIRECTION_OUT) {
            n_out_args++;

            if (g_arg_info_is_caller_allocates (&arg_info)) {
                callable_arg_values[i].v_pointer = AllocateArgument(&arg_info);
            } else /* callee will allocate */ {
                callable_arg_values[i].v_pointer = nullptr;
            }
        }
        else /* (direction == GI_DIRECTION_IN || direction == GI_DIRECTION_INOUT) */ {

            // Fill the IN-argument
            FillArgument(&arg_info, &callable_arg_values[i], info[in_arg]);

            if (param.type == Parameter::ARRAY) {
                GIArgInfo  array_length_arg;
                GITypeInfo array_length_type;
                g_arg_info_load_type (&arg_info, &type_info);

                int length_i = g_type_info_get_array_length (&type_info);
                g_callable_info_load_arg(gi_info, length_i, &array_length_arg);
                g_arg_info_load_type (&array_length_arg, &array_length_type);

                Parameter len_param = call_parameters[length_i];

                /* if (len_param.direction == GI_DIRECTION_IN) {
                 *     callable_arg_values[length_i].v_int = GetV8ArrayLength(info[in_arg]);
                 * }
                 * else if (len_param.direction == GI_DIRECTION_INOUT) {
                 *     len_param.data = new size_t(GetV8ArrayLength(info[in_arg]));
                 *     callable_arg_values[length_i].v_pointer = &len_param.data;
                 * } */

                // FIXME: is this relevant?
                if (g_type_info_is_pointer (&array_length_type))
                    printf("is pointer\n");
                    // callable_arg_values[length_i].v_pointer = &len_param.value;
                // else
                callable_arg_values[length_i].v_int = GetV8ArrayLength(info[in_arg]);
            }

            in_arg++;
        }
    }

    if (can_throw)
        callable_arg_values[i].v_pointer = &error;


    /*
     * Fifth, make the actual ffi_call
     */

    void *ffi_args[n_total_args];
    for (int i = 0; i < n_total_args; i++)
        ffi_args[i] = &total_arg_values[i];

/*     int argc;
 *     char **argv;
 *     int *p_argc;
 *     char ***p_argv;
 * 
 *     if (debug_mode) {
 *         argc = 4;
 *         argv = (char**)malloc(sizeof(char*) * (argc));
 * #define X(x) strcpy((char*)malloc(sizeof x), x);
 *         argv[0] = X("test");
 *         argv[1] = X("--gtk-debug");
 *         argv[2] = X("misc");
 *         argv[3] = X("last");
 * #undef X
 * 
 *         p_argc = &argc;
 *         p_argv = &argv;
 * 
 *         ffi_args[0] = &p_argc;
 *         ffi_args[1] = &p_argv;
 *         printf("argv[1]: %s\n", (***(char****)ffi_args[1]));
 *     } */

    GIArgument return_value;
    GITypeInfo return_type;

    ffi_call (&func->invoker.cif, FFI_FN (func->invoker.native_address),
              &return_value, ffi_args);

    g_callable_info_load_return_type(gi_info, &return_type);
    GITypeTag  return_tag      = g_type_info_get_tag(&return_type);
    GITransfer return_transfer = g_callable_info_get_caller_owns(gi_info);
    // gboolean may_return_null = g_callable_info_may_return_null(gi_info);
    gboolean skip_return = g_callable_info_skip_return(gi_info);

    if (return_tag != GI_TYPE_TAG_VOID && (skip_return == FALSE))
        n_out_args++;

    if (n_out_args > 1)
        WARN("FunctionInvoker: n_out_args == %i", n_out_args);

    for (int i = 0; i < n_callable_args; i++) {
        GIArgInfo  arg_info = {};
        GITypeInfo arg_type;
        GIArgument arg_value = callable_arg_values[i];
        Parameter param = call_parameters[i];

        g_callable_info_load_arg ((GICallableInfo *) gi_info, i, &arg_info);
        g_arg_info_load_type (&arg_info, &arg_type);

        GIDirection direction = g_arg_info_get_direction (&arg_info);
        GITransfer transfer = g_arg_info_get_ownership_transfer (&arg_info);

        bool is_null = false;

        if (direction == GI_DIRECTION_OUT || direction == GI_DIRECTION_INOUT) {

            if (param.type == Parameter::ARRAY) {
                int length;
                int length_pos = g_type_info_get_array_length(&arg_type);

                // FIXME:
                // if (g_type_info_is_pointer(&arg_type))
                    // length = *((int*)callable_arg_values[length_pos].v_pointer);
                // else
                length = callable_arg_values[length_pos].v_int;

                void* array_pointer = arg_value.v_pointer;
                Local<Value> result;
                if (array_pointer == nullptr || length == 0) {
                    result = ArrayToV8(&arg_type, NULL, length);
                    is_null = true;
                } else {
                    result = ArrayToV8(&arg_type, &array_pointer, length);
                }

                RETURN (result);

            } else if (param.type == Parameter::NORMAL
                    || g_arg_info_is_caller_allocates(&arg_info)) {

                RETURN (GIArgumentToV8(&arg_type, &arg_value));
            }

            if (transfer != GI_TRANSFER_NOTHING && !is_null) {
                FreeGIArgument (&arg_type, &arg_value, transfer);
            }

        }
    }

    // FIXME handle more than 1 return value
    if (return_tag != GI_TYPE_TAG_VOID && (!skip_return)) {
        int length = -1;
        int length_pos = g_type_info_get_array_length(&return_type);
        if (length_pos >= 0)
            length = callable_arg_values[length_pos].v_int;
        RETURN (GIArgumentToV8 (&return_type, &return_value, length));
    }

    if (return_transfer != GI_TRANSFER_NOTHING) {
        FreeGIArgument(&return_type, &return_value, return_transfer);
    }

    if (error) {
        Nan::ThrowError(error->message);
        g_error_free(error);
    }
}

void FunctionDestroyed(const v8::WeakCallbackInfo<FunctionInfo> &data) {
    FunctionInfo *func = data.GetParameter ();

    g_base_info_unref (func->info);
    g_function_invoker_destroy (&func->invoker);
    g_free (func);
}

NAN_METHOD(FunctionInfoToString) {
    FunctionInfo *func = (FunctionInfo *) External::Cast (*info.Data ())->Value ();
    GIBaseInfo *fn = func->info; // do-not-free
    GITypeInfo *ret_info = g_callable_info_get_return_type(fn);
    GITypeTag ret_tag = g_type_info_get_tag(ret_info);
    GString *args_string = g_string_new("");

    int n_args = g_callable_info_get_n_args(fn);
    for (int i = 0; i < n_args; i++) {
        if (i != 0)
            g_string_append(args_string, ", ");
        GIArgInfo *arg_info = nullptr;
        GITypeInfo *type_info = nullptr;
        arg_info = g_callable_info_get_arg(fn, i);
        type_info = g_arg_info_get_type(arg_info);
        GITypeTag tag = g_type_info_get_tag(type_info);

        g_string_append(args_string, g_base_info_get_name(arg_info));
        g_string_append_c(args_string, ':');
        g_string_append(args_string, g_type_tag_to_string(tag));

        g_base_info_unref(type_info);
        g_base_info_unref(arg_info);
    }

    gchar *args = g_string_free(args_string, FALSE);
    gchar *string = g_strdup_printf("function %s (%s): %s { [GObject code] }",
        g_function_info_get_symbol(fn), args, g_type_tag_to_string(ret_tag));
    Local<String> result = UTF8(string);
    info.GetReturnValue().Set(result);

    g_free(args);
    g_free(string);

    g_base_info_unref(ret_info);
}

Local<Function> MakeFunction(GIBaseInfo *info) {
    FunctionInfo *func = g_new0 (FunctionInfo, 1);
    func->info = g_base_info_ref (info);
    g_function_info_prep_invoker (func->info, &func->invoker, NULL);

    auto external = New<External>(func);

    int n_args = g_callable_info_get_n_args(info);
    Local<String> name = New(g_function_info_get_symbol(info)).ToLocalChecked();
    Local<Function> toString = New<FunctionTemplate>(FunctionInfoToString, external)->GetFunction();

    auto tpl = New<FunctionTemplate>(FunctionInvoker, external);
    tpl->SetLength(n_args);

    auto fn = tpl->GetFunction();
    fn->SetName(name);
    fn->Set(UTF8("toString"), toString);

    Isolate *isolate = Isolate::GetCurrent();
    Persistent<FunctionTemplate> persistent(isolate, tpl);
    persistent.SetWeak(func, FunctionDestroyed, WeakCallbackType::kParameter);

    return fn;
}


#if 0
class TrampolineInfo {
    ffi_cif cif;
    ffi_closure *closure;
    Persistent<Function> persistent;
    GICallableInfo *info;
    GIScopeType scope_type;

    TrampolineInfo(Handle<Function>  function,
                   GICallableInfo   *info,
                   GIScopeType       scope_type);

    void Dispose();
    static void Call(ffi_cif *cif, void *result, void **args, void *data);
    void *GetClosure();
};

void TrampolineInfo::Dispose() {
    persistent = nullptr;
    g_base_info_unref (info);
    g_callable_info_free_closure (info, closure);
};

void TrampolineInfo::Call(ffi_cif *cif,
                          void *result,
                          void **args,
                          void *data) {
    TrampolineInfo *trampoline = (TrampolineInfo *) data;

    int argc = g_callable_info_get_n_args (trampoline->info);
    Handle<Value> argv[argc];

    for (int i = 0; i < argc; i++) {
        GIArgInfo arg_info;
        g_callable_info_load_arg (trampoline->info, i, &arg_info);
        GITypeInfo type_info;
        g_arg_info_load_type (&arg_info, &type_info);
        argv[i] = GIArgumentToV8 (&type_info, (GIArgument *) &args[i]);
    }

    Handle<Function> func = trampoline->func;
    /* Provide a bogus "this" function. Any interested callers should
     * bind their callbacks to what they're intersted in... */
    Handle<Object> this_obj = func;
    Handle<Value> return_value = func->Call (this_obj, argc, argv);
    GITypeInfo type_info;
    g_callable_info_load_return_type (trampoline->info, &type_info);
    V8ToGIArgument (&type_info, (GIArgument *) &result, return_value,
                    g_callable_info_may_return_null (trampoline->info));
}

TrampolineInfo::TrampolineInfo(Handle<Function>  function,
                               GICallableInfo   *info,
                               GIScopeType       scope_type) {
    this->closure = g_callable_info_prepare_closure (info, &cif, Call, this);
    this->func = Persistent<Function>::New (function);
    this->info = g_base_info_ref (info);
    this->scope_type = scope_type;
}
#endif

};
