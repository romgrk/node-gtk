#include <nan.h>
#include <node.h>
#include <girepository.h>
#include <glib.h>
#include <glib-object.h>

#include "../../debug.h"
#include "../../gi.h"
#include "../../gobject.h"
#include "../../value.h"
#include "context.h"
#include "font-extents.h"
#include "font-face.h"
#include "font-options.h"
#include "glyph.h"
#include "text-cluster.h"
#include "text-extents.h"
#include "matrix.h"
#include "path.h"
#include "pattern.h"
#include "rectangle.h"
#include "rectangle-int.h"
#include "region.h"
#include "scaled-font.h"
#include "surface.h"

using v8::Function;
using v8::FunctionTemplate;
using v8::Local;
using v8::MaybeLocal;
using v8::Object;

namespace GNodeJS {

namespace Cairo {

MaybeLocal<FunctionTemplate> GetTemplate(GIBaseInfo *info) {
    auto ns = g_base_info_get_namespace (info);

    if (strcmp(ns, "cairo") != 0)
        return MaybeLocal<FunctionTemplate> ();

    auto name = g_base_info_get_name (info);

#define ADD_CLASS(klass) \
    if (strcmp(name, #klass) == 0) \
        return MaybeLocal<FunctionTemplate> (Cairo::klass::GetTemplate ());

    ADD_CLASS(Context)
    ADD_CLASS(Matrix)
    ADD_CLASS(Pattern)
    ADD_CLASS(LinearPattern)
    ADD_CLASS(RadialPattern)
    ADD_CLASS(MeshPattern)
    ADD_CLASS(FontOptions)
    ADD_CLASS(FontFace)
    ADD_CLASS(ToyFontFace)
    ADD_CLASS(FtFontFace)
    ADD_CLASS(ScaledFont)
    ADD_CLASS(Win32FontFace)
    ADD_CLASS(QuartzFontFace)
    ADD_CLASS(Region)
    ADD_CLASS(Surface)
    ADD_CLASS(ImageSurface)
    ADD_CLASS(RecordingSurface)

#undef ADD_CLASS

    return MaybeLocal<FunctionTemplate> ();
}


NAN_METHOD(Init) {
    Local<Object> cairoModule = info[0].As<Object>();

    TextExtents::Initialize(cairoModule);
    FontExtents::Initialize(cairoModule);
    FontFace::Initialize(cairoModule);
    Glyph::Initialize(cairoModule);
    Matrix::Initialize(cairoModule);
    Path::Initialize(cairoModule);
    Pattern::Initialize(cairoModule);
    Rectangle::Initialize(cairoModule);
    RectangleInt::Initialize(cairoModule);
    Region::Initialize(cairoModule);
    ScaledFont::Initialize(cairoModule);
    Surface::Initialize(cairoModule);
    TextCluster::Initialize(cairoModule);
}

Local<Object> GetModule() {
    auto exports = Nan::New<Object>();

    Nan::Export(exports, "init", Init);

    return exports;
}


}; // System

}; // GnodeJS
