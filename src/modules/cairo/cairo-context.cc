
#include <cairo.h>

#include "cairo-context.h"
#include "../../debug.h"
#include "../../gi.h"
#include "../../gobject.h"
#include "../../value.h"

using v8::Function;
using v8::Local;
using v8::Object;
using v8::String;


namespace GNodeJS {

namespace Cairo {

NAN_METHOD(setSourceRGB) {
    auto self = info.This();
    auto cr = self->GetAlignedPointerFromInternalField (0);
    auto red   = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto green = Nan::To<double>(info[1].As<Number>()).ToChecked();
    auto blue  = Nan::To<double>(info[2].As<Number>()).ToChecked();

    cairo_set_source_rgb ((cairo_t *)cr,
                       red,
                       green,
                       blue);
}

NAN_METHOD(setSourceRGBA) {
    auto self = info.This();
    auto cr = self->GetAlignedPointerFromInternalField (0);
    auto red   = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto green = Nan::To<double>(info[1].As<Number>()).ToChecked();
    auto blue  = Nan::To<double>(info[2].As<Number>()).ToChecked();
    auto alpha = Nan::To<double>(info[3].As<Number>()).ToChecked();

    cairo_set_source_rgba ((cairo_t *)cr,
                       red,
                       green,
                       blue,
                       alpha);
}

NAN_METHOD(setOperator) {
    auto self = info.This();
    auto cr = self->GetAlignedPointerFromInternalField (0);
    auto op = Nan::To<uint32_t>(info[0].As<Number>()).ToChecked();

    cairo_set_operator ((cairo_t *)cr,
                    (cairo_operator_t) op);
}

NAN_METHOD(selectFontFace) {
    auto self = info.This();
    auto cr = self->GetAlignedPointerFromInternalField (0);
    auto family = *Nan::Utf8String (info[0].As<String>());
    auto slant = Nan::To<uint32_t>(info[1].As<Number>()).ToChecked();
    auto weight = Nan::To<uint32_t>(info[2].As<Number>()).ToChecked();

    cairo_select_font_face ((cairo_t *)cr,
                        (const char *)family,
                        (cairo_font_slant_t) slant,
                        (cairo_font_weight_t) weight);
}

NAN_METHOD(setFontSize) {
    auto self = info.This();
    auto cr = self->GetAlignedPointerFromInternalField (0);
    auto size = Nan::To<double>(info[0].As<Number>()).ToChecked();

    cairo_set_font_size ((cairo_t *)cr,
            size);
}

  /*   cairo_select_font_face(cr, "Sans", CAIRO_FONT_SLANT_NORMAL,
   *       CAIRO_FONT_WEIGHT_NORMAL);
   *   cairo_set_font_size(cr, 40.0);
   * 
   *   cairo_move_to(cr, 10.0, 50.0);
   *   cairo_show_text(cr, "Disziplin ist Macht."); */

NAN_METHOD(moveTo) {
    auto self = info.This();
    auto cr = self->GetAlignedPointerFromInternalField (0);
    auto x     = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto y     = Nan::To<double>(info[1].As<Number>()).ToChecked();

    cairo_move_to ((cairo_t *)cr,
            x,
            y);
}

NAN_METHOD(showText) {
    auto self = info.This();
    auto cr = self->GetAlignedPointerFromInternalField (0);
    auto text = *Nan::Utf8String (info[0].As<String>());

    cairo_show_text ((cairo_t *)cr,
            text);
}

NAN_METHOD(arc) {
    auto self = info.This();
    auto cr = self->GetAlignedPointerFromInternalField (0);
    auto xc     = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto yc     = Nan::To<double>(info[1].As<Number>()).ToChecked();
    auto radius = Nan::To<double>(info[2].As<Number>()).ToChecked();
    auto angle1 = Nan::To<double>(info[3].As<Number>()).ToChecked();
    auto angle2 = Nan::To<double>(info[4].As<Number>()).ToChecked();

    cairo_arc ((cairo_t *)cr,
            xc,
            yc,
            radius,
            angle1,
            angle2);
}

NAN_METHOD(fill) {
    auto self = info.This();
    auto cr = self->GetAlignedPointerFromInternalField (0);

    cairo_fill ((cairo_t *)cr);
}

#define SET_METHOD(target, name) Nan::SetMethod(target, #name, name)

void SetupCairoContext(Local<Function> cairoContext) {
    Local<Object> prototype = Local<Object>::Cast (Nan::Get(cairoContext, UTF8("prototype")).ToLocalChecked());

    SET_METHOD(prototype, setSourceRGBA);
    SET_METHOD(prototype, setSourceRGB);
    SET_METHOD(prototype, setOperator);
    SET_METHOD(prototype, selectFontFace);
    SET_METHOD(prototype, setFontSize);
    SET_METHOD(prototype, moveTo);
    SET_METHOD(prototype, showText);
    SET_METHOD(prototype, arc);
    SET_METHOD(prototype, fill);
}

#undef SET_METHOD

}; // System

}; // GnodeJS
