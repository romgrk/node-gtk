#include <glib.h>
#include <nan.h>

#include "closure.h"
#include "error.h"
#include "macros.h"
#include "loop.h"
#include "type.h"
#include "value.h"

using v8::Context;
using v8::Function;
using v8::HandleScope;
using v8::Isolate;
using v8::Local;
using v8::Object;
using v8::Value;
using Nan::Persistent;

namespace GNodeJS {

/*
 * An (out)/(inout) signal parameter arrives as a GValue holding a *pointer* to
 * the value (e.g. a gint* for an `(inout) (type int)` parameter), not the value
 * itself. Dereference it in place so the argument holds the pointed-to value.
 */
static void LoadGIArgumentFromPointer (GITypeInfo *type_info, GIArgument *arg) {
    gpointer ptr = arg->v_pointer;

    if (ptr == NULL) {
        memset(arg, 0, sizeof(*arg));
        return;
    }

    switch (g_type_info_get_tag(type_info)) {
        case GI_TYPE_TAG_BOOLEAN: arg->v_boolean = *(gboolean*) ptr; break;
        case GI_TYPE_TAG_INT8:    arg->v_int8    = *(gint8*)    ptr; break;
        case GI_TYPE_TAG_UINT8:   arg->v_uint8   = *(guint8*)   ptr; break;
        case GI_TYPE_TAG_INT16:   arg->v_int16   = *(gint16*)   ptr; break;
        case GI_TYPE_TAG_UINT16:  arg->v_uint16  = *(guint16*)  ptr; break;
        case GI_TYPE_TAG_INT32:   arg->v_int32   = *(gint32*)   ptr; break;
        case GI_TYPE_TAG_UNICHAR:
        case GI_TYPE_TAG_UINT32:  arg->v_uint32  = *(guint32*)  ptr; break;
        case GI_TYPE_TAG_INT64:   arg->v_int64   = *(gint64*)   ptr; break;
        case GI_TYPE_TAG_UINT64:  arg->v_uint64  = *(guint64*)  ptr; break;
        case GI_TYPE_TAG_FLOAT:   arg->v_float   = *(gfloat*)   ptr; break;
        case GI_TYPE_TAG_DOUBLE:  arg->v_double  = *(gdouble*)  ptr; break;
        case GI_TYPE_TAG_GTYPE:   arg->v_size    = *(gsize*)    ptr; break;
        default:
            // Pointer-like types (utf8, interface, array, list, ...): the value
            // is itself a pointer stored at *ptr.
            arg->v_pointer = *(gpointer*) ptr;
            break;
    }
}

GClosure *Closure::New (Local<Function> function, GICallableInfo* info, guint signalId) {
    Closure *closure = (Closure *) g_closure_new_simple (sizeof (*closure), GUINT_TO_POINTER(signalId));
    closure->persistent.Reset(function);
    if (info) {
        closure->info = g_base_info_ref(info);
    } else {
        closure->info = NULL;
    }
    GClosure *gclosure = &closure->base;
    g_closure_set_marshal (gclosure, Closure::Marshal);
    g_closure_add_invalidate_notifier (gclosure, NULL, Closure::Invalidated);
    return gclosure;
}

void Closure::Execute(GICallableInfo *info, guint signal_id,
                      const Nan::Persistent<v8::Function> &persFn,
                      GValue *g_return_value, guint n_param_values,
                      const GValue *param_values) {
    Nan::HandleScope scope;
    auto func = Nan::New<Function>(persFn);

    GSignalQuery signal_query = { 0, };

    g_signal_query(signal_id, &signal_query);

    // We don't pass the implicit instance as first argument
    auto n_js_args = n_param_values - 1;

    #ifndef __linux__
        Local<Value>* js_args = new Local<Value>[n_js_args];
    #else
        Local<Value> js_args[n_js_args];
    #endif

    if (info) {
        /* CallableInfo is available: use GIArgumentToV8 */
        GIArgument argument;
        GIArgInfo arg_info;
        GITypeInfo type_info;
        for (guint i = 1; i < n_param_values; i++) {
            memcpy(&argument, &param_values[i].data[0], sizeof(GIArgument));
            g_callable_info_load_arg(info, i - 1, &arg_info);
            g_arg_info_load_type(&arg_info, &type_info);

            ResourceOwnership ownership = kCopy;

            if (signal_query.signal_id) {
                if ((signal_query.param_types[i - 1] & G_SIGNAL_TYPE_STATIC_SCOPE) != 0) {
                    ownership = kNone;
                }
            }

            GIDirection direction = g_arg_info_get_direction(&arg_info);
            if (direction == GI_DIRECTION_INOUT) {
                // The GValue holds a pointer to the in/out value; dereference it
                // so the handler receives the actual value (#405).
                LoadGIArgumentFromPointer(&type_info, &argument);
                ownership = kNone;
            } else if (direction == GI_DIRECTION_OUT) {
                if (g_arg_info_is_caller_allocates(&arg_info)) {
                    // Caller-allocated out (e.g. a GdkRectangle in
                    // GtkOverlay::get-child-position): the GValue already holds a
                    // pointer to caller (GLib/GTK) memory. Pass a live wrapper so the
                    // handler fills it in place — it is NOT written back from the
                    // return value (see the output loop below). #444.
                    ownership = kNone;
                } else {
                    // Callee-allocated out: no meaningful incoming value; the handler
                    // supplies it through the return value.
                    memset(&argument, 0, sizeof(argument));
                    ownership = kNone;
                }
            }

            js_args[i - 1] = GIArgumentToV8(&type_info, &argument, -1, ownership);
        }
    } else {
        /* CallableInfo is not available: use GValueToV8 */
        for (guint i = 1; i < n_param_values; i++) {
            ResourceOwnership ownership = kCopy;

            if (signal_query.signal_id) {
                if ((signal_query.param_types[i - 1] & G_SIGNAL_TYPE_STATIC_SCOPE) != 0) {
                    ownership = kNone;
                }
            }
            js_args[i - 1] = GValueToV8(&param_values[i], ownership);
        }
    }

    Local<Object> self = func;
    Local<Value> return_value;

    Nan::TryCatch try_catch;
    // FIXME: Would be nice to avoid the string allocation if not needed but this is
    // too useful for the moment to not do it.
    if (info)
        Throw::SetContext(" in signal \"%s\"", g_base_info_get_name(info));

    auto result = Nan::Call(func, self, n_js_args, js_args);

    if (!try_catch.HasCaught()
            && result.ToLocal(&return_value)) {

        if (info) {
            // Distribute the handler's return value across the signal's return
            // value and its (out)/(inout) parameters, writing each back (#405).
            // When there is more than one output the handler returns an array,
            // mirroring how out-arguments are returned from a function call.
            GIArgInfo  out_arg_info;
            GITypeInfo out_type_info;

            // Caller-allocated out structs are filled in place via the wrapper
            // passed to the handler, so they are not part of the return value.
            int n_outputs = (g_return_value != NULL) ? 1 : 0;
            for (guint i = 1; i < n_param_values; i++) {
                g_callable_info_load_arg(info, i - 1, &out_arg_info);
                GIDirection d = g_arg_info_get_direction(&out_arg_info);
                if (d == GI_DIRECTION_INOUT ||
                    (d == GI_DIRECTION_OUT && !g_arg_info_is_caller_allocates(&out_arg_info)))
                    n_outputs++;
            }

            bool from_array = n_outputs > 1 && return_value->IsArray();
            int output_index = 0;

            #define NEXT_OUTPUT() ( \
                n_outputs <= 1 \
                    ? return_value \
                    : (from_array \
                        ? Nan::Get(return_value.As<v8::Array>(), output_index++).ToLocalChecked() \
                        : (output_index++, Nan::Undefined().As<Value>())))

            if (g_return_value) {
                if (!V8ToGValue (g_return_value, NEXT_OUTPUT(), kCopy))
                    goto throw_exception;
            }

            for (guint i = 1; i < n_param_values; i++) {
                g_callable_info_load_arg(info, i - 1, &out_arg_info);
                GIDirection d = g_arg_info_get_direction(&out_arg_info);
                if (d != GI_DIRECTION_OUT && d != GI_DIRECTION_INOUT)
                    continue;
                // Caller-allocated out structs were filled in place by the handler
                // via their wrapper; nothing to write back from the return value.
                if (d == GI_DIRECTION_OUT && g_arg_info_is_caller_allocates(&out_arg_info))
                    continue;

                g_arg_info_load_type(&out_arg_info, &out_type_info);

                GIArgument out_arg;
                memcpy(&out_arg, &param_values[i].data[0], sizeof(GIArgument));
                if (out_arg.v_pointer != NULL)
                    V8ToOutGIArgument(&out_type_info, &out_arg, NEXT_OUTPUT(), true);
            }

            #undef NEXT_OUTPUT
        }
        else if (g_return_value) {
            if (!V8ToGValue (g_return_value, return_value, kCopy))
                goto throw_exception;
        }

        CallMicrotaskHandlers ();
    }

throw_exception:
    if (try_catch.HasCaught()) {
        GNodeJS::QuitLoopStack();
        Nan::FatalException (try_catch);
    }

    Throw::ClearContext();

    #ifndef __linux__
        delete[] js_args;
    #endif
}

void Closure::Marshal(GClosure     *base,
                      GValue       *g_return_value,
                      guint         n_param_values,
                      const GValue *param_values,
                      gpointer      invocation_hint,
                      gpointer      marshal_data) {

    auto closure = (Closure *) base;
    auto signal_id = GPOINTER_TO_UINT(marshal_data);

    AsyncCallEnvironment* env = reinterpret_cast<AsyncCallEnvironment *>(AsyncCallEnvironment::asyncHandle.data);

    if (env->IsSameThread()) {
        /* Case 1: same thread */
        Closure::Execute(closure->info, signal_id, closure->persistent, g_return_value, n_param_values, param_values);
    } else {
        /* Case 2: different thread */
        env->Call([&]() {
            Closure::Execute(closure->info, signal_id, closure->persistent, g_return_value, n_param_values, param_values);
        });
    }
}
void Closure::Invalidated (gpointer data, GClosure *base) {
    Closure *closure = (Closure *) base;
    closure->~Closure();
}

};
