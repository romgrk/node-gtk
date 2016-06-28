/*
 * type.cc
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

#include "gi.h"
#include "type.h"
#include "util.h"

using v8::FunctionTemplate;
using v8::Persistent;

namespace GNodeJS {

void ClassDestroyed(const v8::WeakCallbackInfo<GIBaseInfo> &info) {
    GIBaseInfo *gi_info = info.GetParameter ();
    GType gtype = g_registered_type_info_get_g_type ((GIRegisteredTypeInfo *) gi_info);
    void *type_data = g_type_get_qdata (gtype, GNodeJS::template_quark());

    Persistent<FunctionTemplate> *persistent = (Persistent<FunctionTemplate> *) type_data;
    delete persistent;

    g_type_set_qdata (gtype, GNodeJS::template_quark(), NULL);
    g_base_info_unref (gi_info);
}

};

