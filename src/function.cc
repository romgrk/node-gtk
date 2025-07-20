#include <string.h>
#include <girffi.h>

#include "boxed.h"
#include "callback.h"
#include "debug.h"
#include "error.h"
#include "function.h"
#include "gobject.h"
#include "macros.h"
#include "type.h"
#include "value.h"

using v8::Array;
using v8::TypedArray;
using v8::External;
using v8::Function;
using v8::FunctionTemplate;
using v8::Isolate;
using v8::Local;
using v8::Persistent;
using v8::String;
using v8::Value;
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
        return Local<Array>::Cast (TO_OBJECT (value))->Length();
    else if (value->IsString())
        return TO_STRING (value)->Length();
    else if (value->IsTypedArray())
        return Local<TypedArray>::Cast (TO_OBJECT (value))->Length();
    else if (value->IsNull() || value->IsUndefined())
        return 0;

    ERROR("Could not determine array length for value %s",
            *Nan::Utf8String(TO_STRING (value)));
}

static void* AllocateArgument (GIBaseInfo *arg_info) {
    GITypeInfo arg_type;
    g_arg_info_load_type(arg_info, &arg_type);

    g_assert(g_type_info_get_tag(&arg_type) == GI_TYPE_TAG_INTERFACE);

    GIBaseInfo* base_info = g_type_info_get_interface (&arg_type);
    size_t size = Boxed::GetSize (base_info);
    void* pointer = g_malloc0(size);

    g_base_info_unref(base_info);
    return pointer;
}

static bool IsMethod (GIBaseInfo *info) {
    auto flags = g_function_info_get_flags (info);
    return ((flags & GI_FUNCTION_IS_METHOD) != 0 &&
            (flags & GI_FUNCTION_IS_CONSTRUCTOR) == 0);
}

static bool ShouldSkipReturn(GIBaseInfo *info, GITypeInfo *return_type) {
    return g_type_info_get_tag(return_type) == GI_TYPE_TAG_VOID
        || g_callable_info_skip_return(info) == TRUE;
}

static inline bool IsDirectionOut (GIDirection direction) {
    return (direction == GI_DIRECTION_OUT || direction == GI_DIRECTION_INOUT);
}

static inline bool IsDirectionIn (GIDirection direction) {
    return (direction == GI_DIRECTION_IN  || direction == GI_DIRECTION_INOUT);
}

static inline bool IsPointerType(GITypeInfo *type_info) {
    auto tag = g_type_info_get_tag (type_info);

    if (tag != GI_TYPE_TAG_INTERFACE)
        return false;

    auto interface_info = g_type_info_get_interface (type_info);
    auto interface_type = g_base_info_get_type (interface_info);

    bool isPointer =
        interface_type != GI_INFO_TYPE_ENUM &&
        interface_type != GI_INFO_TYPE_FLAGS;

    g_base_info_unref(interface_info);

    return isPointer;
}

bool IsDestroyNotify (GIBaseInfo *info) {
    return strcmp(g_base_info_get_name(info), "DestroyNotify") == 0
        && strcmp(g_base_info_get_namespace(info), "GLib") == 0;
}


/**
 * The constructor just stores the GIBaseInfo ref. The rest of the
 * initialization is done in FunctionInfo::Init, lazily.
 */
FunctionInfo::FunctionInfo (GIBaseInfo* gi_info) {
    info = g_base_info_ref (gi_info);
    call_parameters = nullptr;
}

FunctionInfo::~FunctionInfo () {
    g_base_info_unref (info);

    if (call_parameters != nullptr) {
        g_function_invoker_destroy (&invoker);
        delete[] call_parameters;
    }
}

/**
 * Initializes the parameters metadata (number, directionality, type) and caches it
 */
bool FunctionInfo::Init() {

    if (call_parameters != nullptr)
        return true;

    g_function_info_prep_invoker (info, &invoker, NULL);

    is_method = IsMethod(info);
    can_throw = g_callable_info_can_throw_gerror (info);

    n_callable_args = g_callable_info_get_n_args (info);
    n_total_args = n_callable_args;
    n_out_args = 0;
    n_in_args = 0;

    if (is_method)
        n_total_args++;

    if (can_throw)
        n_total_args++;

    call_parameters = new Parameter[n_callable_args]();

    /*
     * Examine load parameter types and count arguments
     */

    for (int i = 0; i < n_callable_args; i++) {
        GIArgInfo arg_info;
        GITypeInfo type_info;
        g_callable_info_load_arg ((GICallableInfo *) info, i, &arg_info);
        g_arg_info_load_type (&arg_info, &type_info);

        bool may_be_null = g_arg_info_may_be_null (&arg_info);
        GIDirection direction = g_arg_info_get_direction (&arg_info);
        GITypeTag tag = g_type_info_get_tag(&type_info);

        call_parameters[i].direction = direction;

        if (call_parameters[i].type == ParameterType::kSKIP)
            continue;

        // If there is an array length, this is an array
        int length_i = g_type_info_get_array_length (&type_info);
        if (tag == GI_TYPE_TAG_ARRAY && length_i >= 0) {
            call_parameters[i].type        = ParameterType::kARRAY;
            call_parameters[length_i].type = ParameterType::kSKIP;

            // If array length came before, we need to remove it from args count

            if (IsDirectionIn(call_parameters[length_i].direction) && length_i < i)
                n_in_args--;

            if (IsDirectionOut(call_parameters[length_i].direction) && length_i < i)
                n_out_args--;

        } else if (tag == GI_TYPE_TAG_INTERFACE) {

            GIBaseInfo* interface_info = g_type_info_get_interface(&type_info);
            GIInfoType  interface_type = g_base_info_get_type(interface_info);

            if (interface_type == GI_INFO_TYPE_CALLBACK) {
                if (IsDestroyNotify(interface_info)) {
                    /* Skip GDestroyNotify if they appear before the respective callback */
                    call_parameters[i].type = ParameterType::kSKIP;
                } else {
                    call_parameters[i].type = ParameterType::kCALLBACK;

                    int destroy_i = g_arg_info_get_destroy(&arg_info);
                    int closure_i = g_arg_info_get_closure(&arg_info);

                    if (destroy_i >= 0 && closure_i < 0) {
                        Throw::UnsupportedCallback (info);
                        g_base_info_unref(interface_info);
                        return false;
                    }

                    if (destroy_i >= 0 && destroy_i < n_callable_args)
                        call_parameters[destroy_i].type = ParameterType::kSKIP;

                    if (closure_i >= 0 && closure_i < n_callable_args)
                        call_parameters[closure_i].type = ParameterType::kSKIP;

                    if (destroy_i < i) {
                        if (IsDirectionIn(call_parameters[destroy_i].direction))
                            n_in_args--;
                        if (IsDirectionOut(call_parameters[destroy_i].direction))
                            n_out_args--;
                    }

                    if (closure_i < i) {
                        if (IsDirectionIn(call_parameters[closure_i].direction))
                            n_in_args--;
                        if (IsDirectionOut(call_parameters[closure_i].direction))
                            n_out_args--;
                    }
                }
            }

            g_base_info_unref(interface_info);
        }

        if (IsDirectionIn(call_parameters[i].direction) && !may_be_null)
            n_in_args++;

        if (IsDirectionOut(call_parameters[i].direction))
            n_out_args++;

    }

    /*
     * Examine return type
     */

    GITypeInfo return_type;
    g_callable_info_load_return_type(info, &return_type);
    int return_length_i = g_type_info_get_array_length(&return_type);

    if (return_length_i != -1)
        n_out_args--;

    if (!ShouldSkipReturn(info, &return_type))
        n_out_args++;

    return true;
}

/**
 * Type checks the JS arguments, throwing an error.
 * @returns true if types match
 */
bool FunctionInfo::TypeCheck (const Nan::FunctionCallbackInfo<Value> &arguments) {

    if (arguments.Length() < n_in_args) {
        Throw::NotEnoughArguments(n_in_args, arguments.Length());
        return false;
    }

    /*
     * Type check every IN-argument that is not skipped
     */

    for (int in_arg = 0, i = 0; i < n_callable_args; i++) {
        Parameter &param = call_parameters[i];

        if (param.type == ParameterType::kSKIP)
            continue;

        GIArgInfo arg_info;
        g_callable_info_load_arg (info, i, &arg_info);
        GIDirection direction = g_arg_info_get_direction (&arg_info);

        if (direction == GI_DIRECTION_IN || direction == GI_DIRECTION_INOUT) {
            GITypeInfo type_info;
            g_arg_info_load_type (&arg_info, &type_info);
            bool may_be_null = g_arg_info_may_be_null (&arg_info);

            if (!CanConvertV8ToGIArgument(&type_info, arguments[in_arg], may_be_null)) {
                Throw::InvalidType(&arg_info, &type_info, arguments[in_arg]);
                return false;
            }
            in_arg++;
        }
    }

    return true;
}

/**
 * Calls a C function from JS arguments
 * @param func the function info
 * @param info JS call informations
 * @param return_value (out, nullable) the C return value
 * @param error (out, nullable) the C error - if null, can throw a JS error
 * @returns the JS return value, if @return_value is null
 */
Local<Value> FunctionCall (
        FunctionInfo *func,
        const Nan::FunctionCallbackInfo<Value> &info,
        GIArgument *return_value,
        GError **error
    ) {

    Local<Value> jsReturnValue;
    GIBaseInfo *gi_info = func->info; // do-not-free
    bool use_return_value = return_value != NULL;
    bool use_error = error != NULL;

    if (!func->Init())
        return jsReturnValue;

    if (!func->TypeCheck(info))
        return jsReturnValue;

    /*
     * First, add arguments for the instance if it's a method,
     * and for error, if it can throw
     */

    #ifndef __linux__
        GIArgument *total_arg_values = new GIArgument[func->n_total_args]();
    #else
        GIArgument total_arg_values[func->n_total_args];
    #endif

    GIArgument *callable_arg_values;
    GError *error_stack = nullptr;

    if (func->is_method) {
        GIBaseInfo *container = g_base_info_get_container (gi_info);
        V8ToGIArgument(container, &total_arg_values[0], info.This());
        callable_arg_values = &total_arg_values[1];
    } else {
        callable_arg_values = &total_arg_values[0];
    }

    if (func->can_throw)
        callable_arg_values[func->n_callable_args].v_pointer = error != NULL ? error : &error_stack;

    /*
     * Second, allocate OUT-arguments and fill IN-arguments
     */

    for (int in_arg = 0, i = 0; i < func->n_callable_args; i++) {
        Parameter& param = func->call_parameters[i];

        if (param.type == ParameterType::kSKIP)
            continue;

        GIArgInfo arg_info;
        GITypeInfo type_info;
        g_callable_info_load_arg (gi_info, i, &arg_info);
        g_arg_info_load_type (&arg_info, &type_info);
        GIDirection direction = g_arg_info_get_direction (&arg_info);

        if (param.type == ParameterType::kARRAY) {
            GIArgInfo  array_length_arg;
            GITypeInfo array_length_type;

            int length_i = g_type_info_get_array_length (&type_info);
            g_callable_info_load_arg(gi_info, length_i, &array_length_arg);
            g_arg_info_load_type (&array_length_arg, &array_length_type);

            Parameter& len_param = func->call_parameters[length_i];

            if (len_param.direction == GI_DIRECTION_IN) {
                param.length = GetV8ArrayLength(info[in_arg]);

                callable_arg_values[length_i].v_long = param.length;
            }
            else if (len_param.direction == GI_DIRECTION_INOUT) {
                len_param.data.v_long = GetV8ArrayLength(info[in_arg]);

                callable_arg_values[length_i].v_pointer = &len_param.data;
            }
            else if (direction == GI_DIRECTION_OUT) {
                len_param.data = {};

                callable_arg_values[length_i].v_pointer = &len_param.data;
            }
        }
        else if (param.type == ParameterType::kCALLBACK) {
            Callback *callback;
            ffi_closure *closure;

            if (info[in_arg]->IsNullOrUndefined()) {
                closure  = nullptr;
                callback = nullptr;
            } else {
                GICallableInfo *callback_info = g_type_info_get_interface (&type_info);
                GIScopeType scope_type = g_arg_info_get_scope(&arg_info);
                callback = new Callback(info[in_arg].As<Function>(), callback_info, scope_type);
                closure = callback->closure;
                g_base_info_unref (callback_info);
            }

            int destroy_i = g_arg_info_get_destroy(&arg_info);
            int closure_i = g_arg_info_get_closure(&arg_info);

            if (destroy_i >= 0) {
                g_assert (func->call_parameters[destroy_i].type == ParameterType::kSKIP);
                callable_arg_values[destroy_i].v_pointer = callback ? (void*) Callback::DestroyNotify : NULL;
            }

            if (closure_i >= 0) {
                g_assert (func->call_parameters[closure_i].type == ParameterType::kSKIP);
                callable_arg_values[closure_i].v_pointer = callback;
            }

            callable_arg_values[i].v_pointer = closure;
            func->call_parameters[i].data.v_pointer = callback;
        }

        if (direction == GI_DIRECTION_OUT) {
            if (g_arg_info_is_caller_allocates (&arg_info)) {
                callable_arg_values[i].v_pointer = AllocateArgument(&arg_info);
            } else /* callee will allocate */ {
                param.data = {};
                callable_arg_values[i].v_pointer = &param.data;
            }
        }
        else /* (direction == GI_DIRECTION_IN || direction == GI_DIRECTION_INOUT) */ {

            // Callback GIArgument is filled above, for the rest...
            if (param.type != ParameterType::kCALLBACK) {

                // FIXME(handle failure here)
                FillArgument(&arg_info, &callable_arg_values[i], info[in_arg]);

                // Add a level of indirection for INOUT arguments
                if (direction == GI_DIRECTION_INOUT) {
                    param.data = {};
                    param.data.v_pointer = callable_arg_values[i].v_pointer;
                    callable_arg_values[i].v_pointer = &param.data;
                }
            }

            in_arg++;
        }
    }


    /*
     * Third, make the actual ffi_call
     */

    #ifndef __linux__
        void **ffi_args = new void*[func->n_total_args]();
    #else
        void *ffi_args[func->n_total_args];
    #endif

    for (int i = 0; i < func->n_total_args; i++)
        ffi_args[i] = (void *)&total_arg_values[i];

    GIArgument return_value_stack = {0};

    ffi_call (&func->invoker.cif, FFI_FN (func->invoker.native_address),
              use_return_value ? return_value : &return_value_stack, ffi_args);

    #ifndef __linux__
        delete[] ffi_args;
    #endif


    /*
     * Fourth, convert the return value & OUT-arguments back to JS
     */

    GITypeInfo return_type;
    g_callable_info_load_return_type(gi_info, &return_type);
    GITransfer return_transfer = g_callable_info_get_caller_owns(gi_info);

    bool didThrow = error ? *error != NULL : error_stack != NULL;

    // Return the value or throw the error, if any occured
    if (didThrow) {
        jsReturnValue = Nan::Undefined();

        if (!use_error) {
            Nan::ThrowError(error_stack->message);
            g_error_free(error_stack);
        }
    } else if (!use_return_value) {
        jsReturnValue = func->GetReturnValue (
                info.This(),
                &return_type,
                use_return_value ? return_value : &return_value_stack,
                callable_arg_values);
    } else {
        jsReturnValue = Nan::Undefined();
    }


    /*
     * Fifth, free the return value and arguments
     */

    if (!use_return_value)
        FreeGIArgument(&return_type, &return_value_stack, return_transfer);

    for (int i = 0; i < func->n_callable_args; i++) {
        GIArgInfo  arg_info = {};
        GITypeInfo arg_type;
        GIArgument arg_value = callable_arg_values[i];
        Parameter &param = func->call_parameters[i];

        g_callable_info_load_arg ((GICallableInfo *) gi_info, i, &arg_info);
        g_arg_info_load_type (&arg_info, &arg_type);

        GIDirection direction = g_arg_info_get_direction (&arg_info);
        GITransfer transfer   = g_arg_info_get_ownership_transfer (&arg_info);

        if (param.type == ParameterType::kARRAY) {
            if (direction == GI_DIRECTION_INOUT || direction == GI_DIRECTION_OUT)
                FreeGIArgumentArray (&arg_type, (GIArgument*)arg_value.v_pointer, transfer, direction, param.length);
            else
                FreeGIArgumentArray (&arg_type, &arg_value, transfer, direction, param.length);
        }
        else if (param.type == ParameterType::kCALLBACK) {
            Callback *callback = static_cast<Callback*>(func->call_parameters[i].data.v_pointer);

            g_assert(direction == GI_DIRECTION_IN);

            if (callback && callback->scope_type == GI_SCOPE_TYPE_CALL) {
                delete callback;
            }
        }
        else {
            if (direction == GI_DIRECTION_INOUT || (direction == GI_DIRECTION_OUT && !g_arg_info_is_caller_allocates (&arg_info)))
                FreeGIArgument (&arg_type, (GIArgument*)arg_value.v_pointer, transfer, direction);
            else
                FreeGIArgument (&arg_type, &arg_value, transfer, direction);
        }
    }

    #ifndef __linux__
        delete[] total_arg_values;
    #endif

    return jsReturnValue;
}


/**
 * Creates the JS return value from the C arguments list
 * @returns the JS return value
 */
Local<Value> FunctionInfo::GetReturnValue (
        Local<Value> self,
        GITypeInfo* return_type,
        GIArgument* return_value,
        GIArgument* callable_arg_values) {

    Local<Value> jsReturnValue;
    int jsReturnIndex = 0;

    if (n_out_args > 1)
        jsReturnValue = Nan::New<Array>();

#define ADD_RETURN(value)   if (n_out_args > 1) \
                                Nan::Set(TO_OBJECT (jsReturnValue), jsReturnIndex++, (value)); \
                            else \
                                jsReturnValue = (value);

    int return_length_i = g_type_info_get_array_length(return_type);

    if (!ShouldSkipReturn(info, return_type)) {
        long length = -1;

        if (return_length_i >= 0) {
            GIArgInfo length_info;
            g_callable_info_load_arg (info, return_length_i, &length_info);
            GITypeInfo length_type;
            g_arg_info_load_type (&length_info, &length_type);

            length =
                GIArgumentToLength(
                    &length_type,
                    &callable_arg_values[return_length_i],
                    IsDirectionOut(call_parameters[return_length_i].direction));
        }

        // When a method returns the instance itself, skip the conversion and just return the
        // existent wrapper
        bool isReturningSelf = is_method && PointerFromWrapper(self) == return_value->v_pointer;
        ADD_RETURN (isReturningSelf ? self : GIArgumentToV8 (return_type, return_value, length))
    }

    for (int i = 0; i < n_callable_args; i++) {
        if (return_length_i == i)
            continue;

        GIArgInfo  arg_info = {};
        GITypeInfo arg_type;
        GIArgument arg_value = callable_arg_values[i];
        Parameter &param = call_parameters[i];

        g_callable_info_load_arg (info, i, &arg_info);
        g_arg_info_load_type (&arg_info, &arg_type);

        GIDirection direction = g_arg_info_get_direction (&arg_info);

        if (direction == GI_DIRECTION_OUT || direction == GI_DIRECTION_INOUT) {

            if (param.type == ParameterType::kARRAY) {

                int length_i = g_type_info_get_array_length(&arg_type);
                GIArgInfo length_arg;
                g_callable_info_load_arg (info, length_i, &length_arg);
                GITypeInfo length_type;
                g_arg_info_load_type (&length_arg, &length_type);
                GIDirection length_direction = g_arg_info_get_direction(&length_arg);

                param.length =
                    GIArgumentToLength(
                        &length_type,
                        &callable_arg_values[length_i],
                        IsDirectionOut(length_direction));

                Local<Value> result = ArrayToV8(&arg_type, *(void**)arg_value.v_pointer, param.length);

                ADD_RETURN (result)

            } else if (param.type == ParameterType::kNORMAL) {

                if (IsPointerType(&arg_type) && g_arg_info_is_caller_allocates(&arg_info)) {
                    void *pointer = &arg_value.v_pointer;
                    ADD_RETURN (GIArgumentToV8(&arg_type, (GIArgument*) pointer))
                }
                else {
                    ADD_RETURN (GIArgumentToV8(&arg_type, (GIArgument*) arg_value.v_pointer))
                }
            }
        }
    }

#undef ADD_RETURN

    return jsReturnValue;
}

/**
 * Frees the C return value
 * @param return_value the return value pointer
 */
void FunctionInfo::FreeReturnValue (GIArgument *return_value) {
    GITypeInfo return_type;
    g_callable_info_load_return_type(info, &return_type);
    GITransfer return_transfer = g_callable_info_get_caller_owns(info);

    FreeGIArgument(&return_type, return_value, return_transfer);
}



Local<Function> MakeFunction(GIBaseInfo *info) {
    FunctionInfo *func = new FunctionInfo(info);

    auto external = New<External>(func);
    auto name = UTF8(g_function_info_get_symbol (info));

    auto tpl = New<FunctionTemplate>(FunctionInvoker, external);
    tpl->SetLength(g_callable_info_get_n_args (info));

    auto fn = Nan::GetFunction (tpl).ToLocalChecked();
    fn->SetName(name);

    func->persistent = new Nan::Persistent<FunctionTemplate>(tpl);
    func->persistent->SetWeak(func, FunctionDestroyed, WeakCallbackType::kParameter);

    return fn;
}

void FunctionInvoker(const Nan::FunctionCallbackInfo<Value> &info) {
    FunctionInfo *func = (FunctionInfo *) External::Cast (*info.Data ())->Value ();

    Local<Value> jsReturnValue = FunctionCall (func, info);

    if (!jsReturnValue.IsEmpty()) {
        RETURN (jsReturnValue);
    }

    Callback::AsyncFree();
}

void FunctionDestroyed(const Nan::WeakCallbackInfo<FunctionInfo> &data) {
    FunctionInfo *func = data.GetParameter ();
    delete func->persistent;
    delete func;
}

};
