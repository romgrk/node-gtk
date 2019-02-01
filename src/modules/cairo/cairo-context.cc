
#include <cairo.h>

#include "cairo-context.h"
#include "cairo-text-extents.h"
#include "cairo-font-extents.h"
#include "../../debug.h"
#include "../../gi.h"
#include "../../gobject.h"
#include "../../util.h"
#include "../../value.h"

using v8::Function;
using v8::Local;
using v8::Object;
using v8::String;


namespace GNodeJS {

namespace Cairo {

namespace Context {

NAN_METHOD(destroy) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_destroy (cr);

    self->SetAlignedPointerInInternalField (0, NULL);
}

NAN_METHOD(status) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_status_t result = cairo_status (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(save) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_save (cr);
}

NAN_METHOD(restore) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_restore (cr);
}

NAN_METHOD(getTarget) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_surface_t * result = cairo_get_target (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(pushGroup) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_push_group (cr);
}

NAN_METHOD(popGroup) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_pattern_t * result = cairo_pop_group (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(popGroupToSource) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_pop_group_to_source (cr);
}

NAN_METHOD(getGroupTarget) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_surface_t * result = cairo_get_group_target (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(setSourceRgb) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto red = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto green = Nan::To<double>(info[1].As<Number>()).ToChecked();
    auto blue = Nan::To<double>(info[2].As<Number>()).ToChecked();

    // function call
    cairo_set_source_rgb (cr, red, green, blue);
}

NAN_METHOD(setSourceRgba) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto red = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto green = Nan::To<double>(info[1].As<Number>()).ToChecked();
    auto blue = Nan::To<double>(info[2].As<Number>()).ToChecked();
    auto alpha = Nan::To<double>(info[3].As<Number>()).ToChecked();

    // function call
    cairo_set_source_rgba (cr, red, green, blue, alpha);
}

NAN_METHOD(getSource) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_pattern_t * result = cairo_get_source (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(setAntialias) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto antialias = (cairo_antialias_t) Nan::To<int64_t>(info[0].As<Number>()).ToChecked();

    // function call
    cairo_set_antialias (cr, antialias);
}

NAN_METHOD(getAntialias) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_antialias_t result = cairo_get_antialias (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(getDashCount) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    int result = cairo_get_dash_count (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(getDash) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // out-arguments
    double dashes = 0.0;
    double offset = 0.0;

    // function call
    cairo_get_dash (cr, &dashes, &offset);

    // return
    Local<Object> returnValue = Nan::New<Object> ();
    Nan::Set (returnValue, UTF8 ("dashes"), Nan::New (dashes));
    Nan::Set (returnValue, UTF8 ("offset"), Nan::New (offset));
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(setFillRule) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto fill_rule = (cairo_fill_rule_t) Nan::To<int64_t>(info[0].As<Number>()).ToChecked();

    // function call
    cairo_set_fill_rule (cr, fill_rule);
}

NAN_METHOD(getFillRule) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_fill_rule_t result = cairo_get_fill_rule (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(setLineCap) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto line_cap = (cairo_line_cap_t) Nan::To<int64_t>(info[0].As<Number>()).ToChecked();

    // function call
    cairo_set_line_cap (cr, line_cap);
}

NAN_METHOD(getLineCap) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_line_cap_t result = cairo_get_line_cap (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(setLineJoin) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto line_join = (cairo_line_join_t) Nan::To<int64_t>(info[0].As<Number>()).ToChecked();

    // function call
    cairo_set_line_join (cr, line_join);
}

NAN_METHOD(getLineJoin) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_line_join_t result = cairo_get_line_join (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(setLineWidth) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto width = Nan::To<double>(info[0].As<Number>()).ToChecked();

    // function call
    cairo_set_line_width (cr, width);
}

NAN_METHOD(getLineWidth) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    double result = cairo_get_line_width (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(setMiterLimit) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto limit = Nan::To<double>(info[0].As<Number>()).ToChecked();

    // function call
    cairo_set_miter_limit (cr, limit);
}

NAN_METHOD(getMiterLimit) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    double result = cairo_get_miter_limit (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(setOperator) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto op = (cairo_operator_t) Nan::To<int64_t>(info[0].As<Number>()).ToChecked();

    // function call
    cairo_set_operator (cr, op);
}

NAN_METHOD(getOperator) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_operator_t result = cairo_get_operator (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(setTolerance) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto tolerance = Nan::To<double>(info[0].As<Number>()).ToChecked();

    // function call
    cairo_set_tolerance (cr, tolerance);
}

NAN_METHOD(getTolerance) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    double result = cairo_get_tolerance (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(clip) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_clip (cr);
}

NAN_METHOD(clipPreserve) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_clip_preserve (cr);
}

NAN_METHOD(clipExtents) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // out-arguments
    double x1 = 0.0;
    double y1 = 0.0;
    double x2 = 0.0;
    double y2 = 0.0;

    // function call
    cairo_clip_extents (cr, &x1, &y1, &x2, &y2);

    // return
    Local<Object> returnValue = Nan::New<Object> ();
    Nan::Set (returnValue, UTF8 ("x1"), Nan::New (x1));
    Nan::Set (returnValue, UTF8 ("y1"), Nan::New (y1));
    Nan::Set (returnValue, UTF8 ("x2"), Nan::New (x2));
    Nan::Set (returnValue, UTF8 ("y2"), Nan::New (y2));
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(inClip) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto x = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto y = Nan::To<double>(info[1].As<Number>()).ToChecked();

    // function call
    cairo_bool_t result = cairo_in_clip (cr, x, y);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(resetClip) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_reset_clip (cr);
}

NAN_METHOD(copyClipRectangleList) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_rectangle_list_t * result = cairo_copy_clip_rectangle_list (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(fill) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_fill (cr);
}

NAN_METHOD(fillPreserve) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_fill_preserve (cr);
}

NAN_METHOD(fillExtents) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // out-arguments
    double x1 = 0.0;
    double y1 = 0.0;
    double x2 = 0.0;
    double y2 = 0.0;

    // function call
    cairo_fill_extents (cr, &x1, &y1, &x2, &y2);

    // return
    Local<Object> returnValue = Nan::New<Object> ();
    Nan::Set (returnValue, UTF8 ("x1"), Nan::New (x1));
    Nan::Set (returnValue, UTF8 ("y1"), Nan::New (y1));
    Nan::Set (returnValue, UTF8 ("x2"), Nan::New (x2));
    Nan::Set (returnValue, UTF8 ("y2"), Nan::New (y2));
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(inFill) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto x = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto y = Nan::To<double>(info[1].As<Number>()).ToChecked();

    // function call
    cairo_bool_t result = cairo_in_fill (cr, x, y);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(paint) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_paint (cr);
}

NAN_METHOD(paintWithAlpha) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto alpha = Nan::To<double>(info[0].As<Number>()).ToChecked();

    // function call
    cairo_paint_with_alpha (cr, alpha);
}

NAN_METHOD(stroke) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_stroke (cr);
}

NAN_METHOD(strokePreserve) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_stroke_preserve (cr);
}

NAN_METHOD(strokeExtents) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // out-arguments
    double x1 = 0.0;
    double y1 = 0.0;
    double x2 = 0.0;
    double y2 = 0.0;

    // function call
    cairo_stroke_extents (cr, &x1, &y1, &x2, &y2);

    // return
    Local<Object> returnValue = Nan::New<Object> ();
    Nan::Set (returnValue, UTF8 ("x1"), Nan::New (x1));
    Nan::Set (returnValue, UTF8 ("y1"), Nan::New (y1));
    Nan::Set (returnValue, UTF8 ("x2"), Nan::New (x2));
    Nan::Set (returnValue, UTF8 ("y2"), Nan::New (y2));
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(inStroke) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto x = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto y = Nan::To<double>(info[1].As<Number>()).ToChecked();

    // function call
    cairo_bool_t result = cairo_in_stroke (cr, x, y);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(copyPage) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_copy_page (cr);
}

NAN_METHOD(showPage) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_show_page (cr);
}

NAN_METHOD(getReferenceCount) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    unsigned int result = cairo_get_reference_count (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(copyPath) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_path_t * result = cairo_copy_path (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(copyPathFlat) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_path_t * result = cairo_copy_path_flat (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(hasCurrentPoint) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_bool_t result = cairo_has_current_point (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(getCurrentPoint) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // out-arguments
    double x = 0.0;
    double y = 0.0;

    // function call
    cairo_get_current_point (cr, &x, &y);

    // return
    Local<Object> returnValue = Nan::New<Object> ();
    Nan::Set (returnValue, UTF8 ("x"), Nan::New (x));
    Nan::Set (returnValue, UTF8 ("y"), Nan::New (y));
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(newPath) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_new_path (cr);
}

NAN_METHOD(newSubPath) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_new_sub_path (cr);
}

NAN_METHOD(closePath) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_close_path (cr);
}

NAN_METHOD(arc) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto xc = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto yc = Nan::To<double>(info[1].As<Number>()).ToChecked();
    auto radius = Nan::To<double>(info[2].As<Number>()).ToChecked();
    auto angle1 = Nan::To<double>(info[3].As<Number>()).ToChecked();
    auto angle2 = Nan::To<double>(info[4].As<Number>()).ToChecked();

    // function call
    cairo_arc (cr, xc, yc, radius, angle1, angle2);
}

NAN_METHOD(arcNegative) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto xc = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto yc = Nan::To<double>(info[1].As<Number>()).ToChecked();
    auto radius = Nan::To<double>(info[2].As<Number>()).ToChecked();
    auto angle1 = Nan::To<double>(info[3].As<Number>()).ToChecked();
    auto angle2 = Nan::To<double>(info[4].As<Number>()).ToChecked();

    // function call
    cairo_arc_negative (cr, xc, yc, radius, angle1, angle2);
}

NAN_METHOD(curveTo) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto x1 = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto y1 = Nan::To<double>(info[1].As<Number>()).ToChecked();
    auto x2 = Nan::To<double>(info[2].As<Number>()).ToChecked();
    auto y2 = Nan::To<double>(info[3].As<Number>()).ToChecked();
    auto x3 = Nan::To<double>(info[4].As<Number>()).ToChecked();
    auto y3 = Nan::To<double>(info[5].As<Number>()).ToChecked();

    // function call
    cairo_curve_to (cr, x1, y1, x2, y2, x3, y3);
}

NAN_METHOD(lineTo) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto x = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto y = Nan::To<double>(info[1].As<Number>()).ToChecked();

    // function call
    cairo_line_to (cr, x, y);
}

NAN_METHOD(moveTo) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto x = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto y = Nan::To<double>(info[1].As<Number>()).ToChecked();

    // function call
    cairo_move_to (cr, x, y);
}

NAN_METHOD(rectangle) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto x = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto y = Nan::To<double>(info[1].As<Number>()).ToChecked();
    auto width = Nan::To<double>(info[2].As<Number>()).ToChecked();
    auto height = Nan::To<double>(info[3].As<Number>()).ToChecked();

    // function call
    cairo_rectangle (cr, x, y, width, height);
}

NAN_METHOD(textPath) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto utf8 = *Nan::Utf8String (info[0].As<String>());

    // function call
    cairo_text_path (cr, utf8);
}

NAN_METHOD(relCurveTo) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto dx1 = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto dy1 = Nan::To<double>(info[1].As<Number>()).ToChecked();
    auto dx2 = Nan::To<double>(info[2].As<Number>()).ToChecked();
    auto dy2 = Nan::To<double>(info[3].As<Number>()).ToChecked();
    auto dx3 = Nan::To<double>(info[4].As<Number>()).ToChecked();
    auto dy3 = Nan::To<double>(info[5].As<Number>()).ToChecked();

    // function call
    cairo_rel_curve_to (cr, dx1, dy1, dx2, dy2, dx3, dy3);
}

NAN_METHOD(relLineTo) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto dx = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto dy = Nan::To<double>(info[1].As<Number>()).ToChecked();

    // function call
    cairo_rel_line_to (cr, dx, dy);
}

NAN_METHOD(relMoveTo) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto dx = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto dy = Nan::To<double>(info[1].As<Number>()).ToChecked();

    // function call
    cairo_rel_move_to (cr, dx, dy);
}

NAN_METHOD(pathExtents) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // out-arguments
    double x1 = 0.0;
    double y1 = 0.0;
    double x2 = 0.0;
    double y2 = 0.0;

    // function call
    cairo_path_extents (cr, &x1, &y1, &x2, &y2);

    // return
    Local<Object> returnValue = Nan::New<Object> ();
    Nan::Set (returnValue, UTF8 ("x1"), Nan::New (x1));
    Nan::Set (returnValue, UTF8 ("y1"), Nan::New (y1));
    Nan::Set (returnValue, UTF8 ("x2"), Nan::New (x2));
    Nan::Set (returnValue, UTF8 ("y2"), Nan::New (y2));
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(showText) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto utf8 = *Nan::Utf8String (info[0].As<String>());

    // function call
    cairo_show_text (cr, utf8);
}

NAN_METHOD(textExtents) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto utf8 = *Nan::Utf8String (info[0].As<String>());

    // out-arguments
    auto extents = Nan::NewInstance(
            Nan::New<FunctionTemplate>(TextExtents::constructor)->GetFunction(),
            0,
            NULL).ToLocalChecked();

    // function call
    cairo_text_extents (cr, utf8, Nan::ObjectWrap::Unwrap<TextExtents>(extents)->_data);

    // return
    Local<Value> returnValue = extents;
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(fontExtents) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // out-arguments
    auto extents = Nan::NewInstance(
            Nan::New<FunctionTemplate>(FontExtents::constructor)->GetFunction(),
            0,
            NULL).ToLocalChecked();

    // function call
    cairo_font_extents (cr, Nan::ObjectWrap::Unwrap<FontExtents>(extents)->_data);

    // return
    Local<Value> returnValue = extents;
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(selectFontFace) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto family = *Nan::Utf8String (info[0].As<String>());
    auto slant = (cairo_font_slant_t) Nan::To<int64_t>(info[1].As<Number>()).ToChecked();
    auto weight = (cairo_font_weight_t) Nan::To<int64_t>(info[2].As<Number>()).ToChecked();

    // function call
    cairo_select_font_face (cr, family, slant, weight);
}

NAN_METHOD(setFontSize) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto size = Nan::To<double>(info[0].As<Number>()).ToChecked();

    // function call
    cairo_set_font_size (cr, size);
}

NAN_METHOD(getFontFace) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_font_face_t * result = cairo_get_font_face (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(getScaledFont) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_scaled_font_t * result = cairo_get_scaled_font (cr);

    // return
    Local<Value> returnValue = Nan::New (result);
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(translate) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto tx = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto ty = Nan::To<double>(info[1].As<Number>()).ToChecked();

    // function call
    cairo_translate (cr, tx, ty);
}

NAN_METHOD(scale) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto sx = Nan::To<double>(info[0].As<Number>()).ToChecked();
    auto sy = Nan::To<double>(info[1].As<Number>()).ToChecked();

    // function call
    cairo_scale (cr, sx, sy);
}

NAN_METHOD(rotate) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto angle = Nan::To<double>(info[0].As<Number>()).ToChecked();

    // function call
    cairo_rotate (cr, angle);
}

NAN_METHOD(identityMatrix) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // function call
    cairo_identity_matrix (cr);
}

NAN_METHOD(userToDevice) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // out-arguments
    double x = 0.0;
    double y = 0.0;

    // function call
    cairo_user_to_device (cr, &x, &y);

    // return
    Local<Object> returnValue = Nan::New<Object> ();
    Nan::Set (returnValue, UTF8 ("x"), Nan::New (x));
    Nan::Set (returnValue, UTF8 ("y"), Nan::New (y));
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(userToDeviceDistance) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // out-arguments
    double dx = 0.0;
    double dy = 0.0;

    // function call
    cairo_user_to_device_distance (cr, &dx, &dy);

    // return
    Local<Object> returnValue = Nan::New<Object> ();
    Nan::Set (returnValue, UTF8 ("dx"), Nan::New (dx));
    Nan::Set (returnValue, UTF8 ("dy"), Nan::New (dy));
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(deviceToUser) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // out-arguments
    double x = 0.0;
    double y = 0.0;

    // function call
    cairo_device_to_user (cr, &x, &y);

    // return
    Local<Object> returnValue = Nan::New<Object> ();
    Nan::Set (returnValue, UTF8 ("x"), Nan::New (x));
    Nan::Set (returnValue, UTF8 ("y"), Nan::New (y));
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(deviceToUserDistance) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // out-arguments
    double dx = 0.0;
    double dy = 0.0;

    // function call
    cairo_device_to_user_distance (cr, &dx, &dy);

    // return
    Local<Object> returnValue = Nan::New<Object> ();
    Nan::Set (returnValue, UTF8 ("dx"), Nan::New (dx));
    Nan::Set (returnValue, UTF8 ("dy"), Nan::New (dy));
    info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(tagBegin) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto tag_name = *Nan::Utf8String (info[0].As<String>());
    auto attributes = *Nan::Utf8String (info[1].As<String>());

    // function call
    cairo_tag_begin (cr, tag_name, attributes);
}

NAN_METHOD(tagEnd) {
    auto self = info.This();
    auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

    // in-arguments
    auto tag_name = *Nan::Utf8String (info[0].As<String>());

    // function call
    cairo_tag_end (cr, tag_name);
}

#define SET_METHOD(tpl, name) Nan::SetPrototypeMethod(tpl, #name, name)

static void AttachMethods(Local<FunctionTemplate> tpl) {
    SET_METHOD(tpl, destroy);
    SET_METHOD(tpl, status);
    SET_METHOD(tpl, save);
    SET_METHOD(tpl, restore);
    SET_METHOD(tpl, getTarget);
    SET_METHOD(tpl, pushGroup);
    SET_METHOD(tpl, popGroup);
    SET_METHOD(tpl, popGroupToSource);
    SET_METHOD(tpl, getGroupTarget);
    SET_METHOD(tpl, setSourceRgb);
    SET_METHOD(tpl, setSourceRgba);
    SET_METHOD(tpl, getSource);
    SET_METHOD(tpl, setAntialias);
    SET_METHOD(tpl, getAntialias);
    SET_METHOD(tpl, getDashCount);
    SET_METHOD(tpl, getDash);
    SET_METHOD(tpl, setFillRule);
    SET_METHOD(tpl, getFillRule);
    SET_METHOD(tpl, setLineCap);
    SET_METHOD(tpl, getLineCap);
    SET_METHOD(tpl, setLineJoin);
    SET_METHOD(tpl, getLineJoin);
    SET_METHOD(tpl, setLineWidth);
    SET_METHOD(tpl, getLineWidth);
    SET_METHOD(tpl, setMiterLimit);
    SET_METHOD(tpl, getMiterLimit);
    SET_METHOD(tpl, setOperator);
    SET_METHOD(tpl, getOperator);
    SET_METHOD(tpl, setTolerance);
    SET_METHOD(tpl, getTolerance);
    SET_METHOD(tpl, clip);
    SET_METHOD(tpl, clipPreserve);
    SET_METHOD(tpl, clipExtents);
    SET_METHOD(tpl, inClip);
    SET_METHOD(tpl, resetClip);
    SET_METHOD(tpl, copyClipRectangleList);
    SET_METHOD(tpl, fill);
    SET_METHOD(tpl, fillPreserve);
    SET_METHOD(tpl, fillExtents);
    SET_METHOD(tpl, inFill);
    SET_METHOD(tpl, paint);
    SET_METHOD(tpl, paintWithAlpha);
    SET_METHOD(tpl, stroke);
    SET_METHOD(tpl, strokePreserve);
    SET_METHOD(tpl, strokeExtents);
    SET_METHOD(tpl, inStroke);
    SET_METHOD(tpl, copyPage);
    SET_METHOD(tpl, showPage);
    SET_METHOD(tpl, getReferenceCount);
    SET_METHOD(tpl, copyPath);
    SET_METHOD(tpl, copyPathFlat);
    SET_METHOD(tpl, hasCurrentPoint);
    SET_METHOD(tpl, getCurrentPoint);
    SET_METHOD(tpl, newPath);
    SET_METHOD(tpl, newSubPath);
    SET_METHOD(tpl, closePath);
    SET_METHOD(tpl, arc);
    SET_METHOD(tpl, arcNegative);
    SET_METHOD(tpl, curveTo);
    SET_METHOD(tpl, lineTo);
    SET_METHOD(tpl, moveTo);
    SET_METHOD(tpl, rectangle);
    SET_METHOD(tpl, textPath);
    SET_METHOD(tpl, relCurveTo);
    SET_METHOD(tpl, relLineTo);
    SET_METHOD(tpl, relMoveTo);
    SET_METHOD(tpl, pathExtents);
    SET_METHOD(tpl, showText);
    SET_METHOD(tpl, textExtents);
    SET_METHOD(tpl, fontExtents);
    SET_METHOD(tpl, selectFontFace);
    SET_METHOD(tpl, setFontSize);
    SET_METHOD(tpl, getFontFace);
    SET_METHOD(tpl, getScaledFont);
    SET_METHOD(tpl, translate);
    SET_METHOD(tpl, scale);
    SET_METHOD(tpl, rotate);
    SET_METHOD(tpl, identityMatrix);
    SET_METHOD(tpl, userToDevice);
    SET_METHOD(tpl, userToDeviceDistance);
    SET_METHOD(tpl, deviceToUser);
    SET_METHOD(tpl, deviceToUserDistance);
    SET_METHOD(tpl, tagBegin);
    SET_METHOD(tpl, tagEnd);
}

#undef SET_METHOD

static void InstanceDestroyed(const Nan::WeakCallbackInfo<ContextInfo> &info);

static void InstanceConstructor(const Nan::FunctionCallbackInfo<Value> &info) {
    /* See gobject.cc for how this works */
    if (!info.IsConstructCall ()) {
        Nan::ThrowTypeError("Not a construct call");
        return;
    }

    cairo_t *context = NULL;
    Local<Object> self = info.This ();

    if (info[0]->IsExternal ()) {
        /* The External case. This is how WrapperFromBoxed is called. */

        context = cairo_reference ((cairo_t *) External::Cast(*info[0])->Value());

    } else {
        /* User code calling `new Cairo.Context(surface)` */
        /* TODO: use cairo_create (cairo_surface_t *) */

        Nan::ThrowTypeError("Not supported yet");

        return;
    }

    self->SetAlignedPointerInInternalField (0, context);

    SET_OBJECT_GTYPE (self, -1);

    auto* contextInfo = new ContextInfo();
    contextInfo->context = context;
    contextInfo->persistent = new Nan::Persistent<Object>(self);
    contextInfo->persistent->SetWeak(contextInfo, InstanceDestroyed, Nan::WeakCallbackType::kParameter);
}

static void InstanceDestroyed(const Nan::WeakCallbackInfo<ContextInfo> &info) {
    auto contextInfo = info.GetParameter();

    if (contextInfo->context != NULL) {
        cairo_destroy (contextInfo->context);
    }

    delete contextInfo->persistent;
    delete contextInfo;
}

Local<FunctionTemplate> GetTemplate() {
    auto tpl = Nan::New<FunctionTemplate> (InstanceConstructor);
    AttachMethods (tpl);
    return tpl;
}



}; // Context

}; // Cairo

}; // GnodeJS

/*

CairoContext:

cairo_t * cairo_create (cairo_surface_t *target);
cairo_t * cairo_reference (cairo_t *cr);
void cairo_destroy (cairo_t *cr);
cairo_status_t cairo_status (cairo_t *cr);
void cairo_save (cairo_t *cr);
void cairo_restore (cairo_t *cr);
cairo_surface_t * cairo_get_target (cairo_t *cr);
void cairo_push_group (cairo_t *cr);
void cairo_push_group_with_content (cairo_t *cr, cairo_content_t content);
cairo_pattern_t * cairo_pop_group (cairo_t *cr);
void cairo_pop_group_to_source (cairo_t *cr);
cairo_surface_t * cairo_get_group_target (cairo_t *cr);
void cairo_set_source_rgb (cairo_t *cr, double red, double green, double blue);
void cairo_set_source_rgba (cairo_t *cr, double red, double green, double blue, double alpha);
void cairo_set_source (cairo_t *cr, cairo_pattern_t *source);
void cairo_set_source_surface (cairo_t *cr, cairo_surface_t *surface, double x, double y);
cairo_pattern_t * cairo_get_source (cairo_t *cr);
void cairo_set_antialias (cairo_t *cr, cairo_antialias_t antialias);
cairo_antialias_t cairo_get_antialias (cairo_t *cr);
void cairo_set_dash (cairo_t *cr, const double *dashes, int num_dashes, double offset);
int cairo_get_dash_count (cairo_t *cr);
void cairo_get_dash (cairo_t *cr, double *dashes, double *offset);
void cairo_set_fill_rule (cairo_t *cr, cairo_fill_rule_t fill_rule);
cairo_fill_rule_t cairo_get_fill_rule (cairo_t *cr);
void cairo_set_line_cap (cairo_t *cr, cairo_line_cap_t line_cap);
cairo_line_cap_t cairo_get_line_cap (cairo_t *cr);
void cairo_set_line_join (cairo_t *cr, cairo_line_join_t line_join);
cairo_line_join_t cairo_get_line_join (cairo_t *cr);
void cairo_set_line_width (cairo_t *cr, double width);
double cairo_get_line_width (cairo_t *cr);
void cairo_set_miter_limit (cairo_t *cr, double limit);
double cairo_get_miter_limit (cairo_t *cr);
void cairo_set_operator (cairo_t *cr, cairo_operator_t op);
cairo_operator_t cairo_get_operator (cairo_t *cr);
void cairo_set_tolerance (cairo_t *cr, double tolerance);
double cairo_get_tolerance (cairo_t *cr);
void cairo_clip (cairo_t *cr);
void cairo_clip_preserve (cairo_t *cr);
void cairo_clip_extents (cairo_t *cr, double *x1, double *y1, double *x2, double *y2);
cairo_bool_t cairo_in_clip (cairo_t *cr, double x, double y);
void cairo_reset_clip (cairo_t *cr);
void cairo_rectangle_list_destroy (cairo_rectangle_list_t *rectangle_list);
cairo_rectangle_list_t * cairo_copy_clip_rectangle_list (cairo_t *cr);
void cairo_fill (cairo_t *cr);
void cairo_fill_preserve (cairo_t *cr);
void cairo_fill_extents (cairo_t *cr, double *x1, double *y1, double *x2, double *y2);
cairo_bool_t cairo_in_fill (cairo_t *cr, double x, double y);
void cairo_mask (cairo_t *cr, cairo_pattern_t *pattern);
void cairo_mask_surface (cairo_t *cr, cairo_surface_t *surface, double surface_x, double surface_y);
void cairo_paint (cairo_t *cr);
void cairo_paint_with_alpha (cairo_t *cr, double alpha);
void cairo_stroke (cairo_t *cr);
void cairo_stroke_preserve (cairo_t *cr);
void cairo_stroke_extents (cairo_t *cr, double *x1, double *y1, double *x2, double *y2);
cairo_bool_t cairo_in_stroke (cairo_t *cr, double x, double y);
void cairo_copy_page (cairo_t *cr);
void cairo_show_page (cairo_t *cr);
unsigned int cairo_get_reference_count (cairo_t *cr);
cairo_status_t cairo_set_user_data (cairo_t *cr, const cairo_user_data_key_t *key, void *user_data, cairo_destroy_func_t destroy);
void * cairo_get_user_data (cairo_t *cr, const cairo_user_data_key_t *key);
typedef struct _cairo cairo_t;
typedef struct { double x, y, width, height; } cairo_rectangle_t;
typedef struct { cairo_status_t status; cairo_rectangle_t *rectangles; int num_rectangles; } cairo_rectangle_list_t;

cairo_path_t * cairo_copy_path (cairo_t *cr);
cairo_path_t * cairo_copy_path_flat (cairo_t *cr);
void cairo_path_destroy (cairo_path_t *path);
void cairo_append_path (cairo_t *cr, const cairo_path_t *path);
cairo_bool_t cairo_has_current_point (cairo_t *cr);
void cairo_get_current_point (cairo_t *cr, double *x, double *y);
void cairo_new_path (cairo_t *cr);
void cairo_new_sub_path (cairo_t *cr);
void cairo_close_path (cairo_t *cr);
void cairo_arc (cairo_t *cr, double xc, double yc, double radius, double angle1, double angle2);
void cairo_arc_negative (cairo_t *cr, double xc, double yc, double radius, double angle1, double angle2);
void cairo_curve_to (cairo_t *cr, double x1, double y1, double x2, double y2, double x3, double y3);
void cairo_line_to (cairo_t *cr, double x, double y);
void cairo_move_to (cairo_t *cr, double x, double y);
void cairo_rectangle (cairo_t *cr, double x, double y, double width, double height);
void cairo_glyph_path (cairo_t *cr, const cairo_glyph_t *glyphs, int num_glyphs);
void cairo_text_path (cairo_t *cr, const char *utf8);
void cairo_rel_curve_to (cairo_t *cr, double dx1, double dy1, double dx2, double dy2, double dx3, double dy3);
void cairo_rel_line_to (cairo_t *cr, double dx, double dy);
void cairo_rel_move_to (cairo_t *cr, double dx, double dy);
void cairo_path_extents (cairo_t *cr, double *x1, double *y1, double *x2, double *y2);
typedef struct { cairo_status_t status; cairo_path_data_t *data; int num_data; } cairo_path_t;

void cairo_show_text (cairo_t *cr, const char *utf8);
void cairo_show_glyphs (cairo_t *cr, const cairo_glyph_t *glyphs, int num_glyphs);
void cairo_show_text_glyphs (cairo_t *cr, const char *utf8, int utf8_len, const cairo_glyph_t *glyphs, int num_glyphs, const cairo_text_cluster_t *clusters, int num_clusters, cairo_text_cluster_flags_t cluster_flags);
void cairo_font_extents (cairo_t *cr, cairo_font_extents_t *extents);
void cairo_text_extents (cairo_t *cr, const char *utf8, cairo_text_extents_t *extents);
void cairo_glyph_extents (cairo_t *cr, const cairo_glyph_t *glyphs, int num_glyphs, cairo_text_extents_t *extents);
void cairo_select_font_face (cairo_t *cr, const char *family, cairo_font_slant_t slant, cairo_font_weight_t weight);
void cairo_set_font_size (cairo_t *cr, double size);

void cairo_set_font_matrix (cairo_t *cr, const cairo_matrix_t *matrix);
void cairo_get_font_matrix (cairo_t *cr, cairo_matrix_t *matrix);

void cairo_set_font_options (cairo_t *cr, const cairo_font_options_t *options);
void cairo_get_font_options (cairo_t *cr, cairo_font_options_t *options);

void cairo_set_font_face (cairo_t *cr, cairo_font_face_t *font_face);
cairo_font_face_t * cairo_get_font_face (cairo_t *cr);

void cairo_set_scaled_font (cairo_t *cr, const cairo_scaled_font_t *scaled_font);
cairo_scaled_font_t * cairo_get_scaled_font (cairo_t *cr);

void cairo_translate (cairo_t *cr, double tx, double ty);
void cairo_scale (cairo_t *cr, double sx, double sy);
void cairo_rotate (cairo_t *cr, double angle);
void cairo_transform (cairo_t *cr, const cairo_matrix_t *matrix);
void cairo_set_matrix (cairo_t *cr, const cairo_matrix_t *matrix);
void cairo_get_matrix (cairo_t *cr, cairo_matrix_t *matrix);
void cairo_identity_matrix (cairo_t *cr);
void cairo_user_to_device (cairo_t *cr, double *x, double *y);
void cairo_user_to_device_distance (cairo_t *cr, double *dx, double *dy);
void cairo_device_to_user (cairo_t *cr, double *x, double *y);
void cairo_device_to_user_distance (cairo_t *cr, double *dx, double *dy);

void cairo_tag_begin (cairo_t *cr, const char *tag_name, const char *attributes);
void cairo_tag_end (cairo_t *cr, const char *tag_name);
#define CAIRO_TAG_DEST "cairo.dest"
#define CAIRO_TAG_LINK "Link"


FontFace:

cairo_font_face_t * cairo_toy_font_face_create (const char *family, cairo_font_slant_t slant, cairo_font_weight_t weight);
const char * cairo_toy_font_face_get_family (cairo_font_face_t *font_face);
cairo_font_slant_t cairo_toy_font_face_get_slant (cairo_font_face_t *font_face);
cairo_font_weight_t cairo_toy_font_face_get_weight (cairo_font_face_t *font_face);
cairo_glyph_t * cairo_glyph_allocate (int num_glyphs);
void cairo_glyph_free (cairo_glyph_t *glyphs);
cairo_text_cluster_t * cairo_text_cluster_allocate (int num_clusters);
void cairo_text_cluster_free (cairo_text_cluster_t *clusters);
typedef struct { unsigned long index; double x; double y; } cairo_glyph_t;
typedef struct { int num_bytes; int num_glyphs; } cairo_text_cluster_t;

void cairo_pattern_add_color_stop_rgb (cairo_pattern_t *pattern, double offset, double red, double green, double blue);
void cairo_pattern_add_color_stop_rgba (cairo_pattern_t *pattern, double offset, double red, double green, double blue, double alpha);
cairo_status_t cairo_pattern_get_color_stop_count (cairo_pattern_t *pattern, int *count);
cairo_status_t cairo_pattern_get_color_stop_rgba (cairo_pattern_t *pattern, int index, double *offset, double *red, double *green, double *blue, double *alpha);
cairo_pattern_t * cairo_pattern_create_rgb (double red, double green, double blue);
cairo_pattern_t * cairo_pattern_create_rgba (double red, double green, double blue, double alpha);
cairo_status_t cairo_pattern_get_rgba (cairo_pattern_t *pattern, double *red, double *green, double *blue, double *alpha);
cairo_pattern_t * cairo_pattern_create_for_surface (cairo_surface_t *surface);
cairo_status_t cairo_pattern_get_surface (cairo_pattern_t *pattern, cairo_surface_t **surface);
cairo_pattern_t * cairo_pattern_create_linear (double x0, double y0, double x1, double y1);
cairo_status_t cairo_pattern_get_linear_points (cairo_pattern_t *pattern, double *x0, double *y0, double *x1, double *y1);
cairo_pattern_t * cairo_pattern_create_radial (double cx0, double cy0, double radius0, double cx1, double cy1, double radius1);
cairo_status_t cairo_pattern_get_radial_circles (cairo_pattern_t *pattern, double *x0, double *y0, double *r0, double *x1, double *y1, double *r1);
cairo_pattern_t * cairo_pattern_create_mesh (void);
void cairo_mesh_pattern_begin_patch (cairo_pattern_t *pattern);
void cairo_mesh_pattern_end_patch (cairo_pattern_t *pattern);
void cairo_mesh_pattern_move_to (cairo_pattern_t *pattern, double x, double y);
void cairo_mesh_pattern_line_to (cairo_pattern_t *pattern, double x, double y);
void cairo_mesh_pattern_curve_to (cairo_pattern_t *pattern, double x1, double y1, double x2, double y2, double x3, double y3);
void cairo_mesh_pattern_set_control_point (cairo_pattern_t *pattern, unsigned int point_num, double x, double y);
void cairo_mesh_pattern_set_corner_color_rgb (cairo_pattern_t *pattern, unsigned int corner_num, double red, double green, double blue);
void cairo_mesh_pattern_set_corner_color_rgba (cairo_pattern_t *pattern, unsigned int corner_num, double red, double green, double blue, double alpha);
cairo_status_t cairo_mesh_pattern_get_patch_count (cairo_pattern_t *pattern, unsigned int *count);
cairo_path_t * cairo_mesh_pattern_get_path (cairo_pattern_t *pattern, unsigned int patch_num);
cairo_status_t cairo_mesh_pattern_get_control_point (cairo_pattern_t *pattern, unsigned int patch_num, unsigned int point_num, double *x, double *y);
cairo_status_t cairo_mesh_pattern_get_corner_color_rgba (cairo_pattern_t *pattern, unsigned int patch_num, unsigned int corner_num, double *red, double *green, double *blue, double *alpha);
cairo_pattern_t * cairo_pattern_reference (cairo_pattern_t *pattern);
void cairo_pattern_destroy (cairo_pattern_t *pattern);
cairo_status_t cairo_pattern_status (cairo_pattern_t *pattern);
void cairo_pattern_set_extend (cairo_pattern_t *pattern, cairo_extend_t extend);
cairo_extend_t cairo_pattern_get_extend (cairo_pattern_t *pattern);
void cairo_pattern_set_filter (cairo_pattern_t *pattern, cairo_filter_t filter);
cairo_filter_t cairo_pattern_get_filter (cairo_pattern_t *pattern);
void cairo_pattern_set_matrix (cairo_pattern_t *pattern, const cairo_matrix_t *matrix);
void cairo_pattern_get_matrix (cairo_pattern_t *pattern, cairo_matrix_t *matrix);
cairo_pattern_type_t cairo_pattern_get_type (cairo_pattern_t *pattern);
unsigned int cairo_pattern_get_reference_count (cairo_pattern_t *pattern);
cairo_status_t cairo_pattern_set_user_data (cairo_pattern_t *pattern, const cairo_user_data_key_t *key, void *user_data, cairo_destroy_func_t destroy);
void * cairo_pattern_get_user_data (cairo_pattern_t *pattern, const cairo_user_data_key_t *key);
typedef struct _cairo_pattern cairo_pattern_t;

cairo_region_t * cairo_region_create (void);
cairo_region_t * cairo_region_create_rectangle (const cairo_rectangle_int_t *rectangle);
cairo_region_t * cairo_region_create_rectangles (const cairo_rectangle_int_t *rects, int count);
cairo_region_t * cairo_region_copy (const cairo_region_t *original);
cairo_region_t * cairo_region_reference (cairo_region_t *region);
void cairo_region_destroy (cairo_region_t *region);
cairo_status_t cairo_region_status (const cairo_region_t *region);
void cairo_region_get_extents (const cairo_region_t *region, cairo_rectangle_int_t *extents);
int cairo_region_num_rectangles (const cairo_region_t *region);
void cairo_region_get_rectangle (const cairo_region_t *region, int nth, cairo_rectangle_int_t *rectangle);
cairo_bool_t cairo_region_is_empty (const cairo_region_t *region);
cairo_bool_t cairo_region_contains_point (const cairo_region_t *region, int x, int y);
cairo_region_overlap_t cairo_region_contains_rectangle (const cairo_region_t *region, const cairo_rectangle_int_t *rectangle);
cairo_bool_t cairo_region_equal (const cairo_region_t *a, const cairo_region_t *b);
void cairo_region_translate (cairo_region_t *region, int dx, int dy);
cairo_status_t cairo_region_intersect (cairo_region_t *dst, const cairo_region_t *other);
cairo_status_t cairo_region_intersect_rectangle (cairo_region_t *dst, const cairo_rectangle_int_t *rectangle);
cairo_status_t cairo_region_subtract (cairo_region_t *dst, const cairo_region_t *other);
cairo_status_t cairo_region_subtract_rectangle (cairo_region_t *dst, const cairo_rectangle_int_t *rectangle);
cairo_status_t cairo_region_union (cairo_region_t *dst, const cairo_region_t *other);
cairo_status_t cairo_region_union_rectangle (cairo_region_t *dst, const cairo_rectangle_int_t *rectangle);
cairo_status_t cairo_region_xor (cairo_region_t *dst, const cairo_region_t *other);
cairo_status_t cairo_region_xor_rectangle (cairo_region_t *dst, const cairo_rectangle_int_t *rectangle);
typedef struct _cairo_region cairo_region_t;

cairo_pattern_t * cairo_pattern_create_raster_source (void *user_data, cairo_content_t content, int width, int height);
void cairo_raster_source_pattern_set_callback_data (cairo_pattern_t *pattern, void *data);
void * cairo_raster_source_pattern_get_callback_data (cairo_pattern_t *pattern);
void cairo_raster_source_pattern_set_acquire (cairo_pattern_t *pattern, cairo_raster_source_acquire_func_t acquire, cairo_raster_source_release_func_t release);
void cairo_raster_source_pattern_get_acquire (cairo_pattern_t *pattern, cairo_raster_source_acquire_func_t *acquire, cairo_raster_source_release_func_t *release);
void cairo_raster_source_pattern_set_snapshot (cairo_pattern_t *pattern, cairo_raster_source_snapshot_func_t snapshot);
cairo_raster_source_snapshot_func_t cairo_raster_source_pattern_get_snapshot (cairo_pattern_t *pattern);
void cairo_raster_source_pattern_set_copy (cairo_pattern_t *pattern, cairo_raster_source_copy_func_t copy);
cairo_raster_source_copy_func_t cairo_raster_source_pattern_get_copy (cairo_pattern_t *pattern);
void cairo_raster_source_pattern_set_finish (cairo_pattern_t *pattern, cairo_raster_source_finish_func_t finish);
cairo_raster_source_finish_func_t cairo_raster_source_pattern_get_finish (cairo_pattern_t *pattern);
cairo_surface_t (*cairo_raster_source_acquire_func_t) (cairo_pattern_t *pattern, void *callback_data, cairo_surface_t *target, const cairo_rectangle_int_t *extents);
void (*cairo_raster_source_release_func_t) (cairo_pattern_t *pattern, void *callback_data, cairo_surface_t *surface);
cairo_status_t (*cairo_raster_source_snapshot_func_t) (cairo_pattern_t *pattern, void *callback_data);
cairo_status_t (*cairo_raster_source_copy_func_t) (cairo_pattern_t *pattern, void *callback_data, const cairo_pattern_t *other);
void (*cairo_raster_source_finish_func_t) (cairo_pattern_t *pattern, void *callback_data);

cairo_font_face_t * cairo_font_face_reference (cairo_font_face_t *font_face);
void cairo_font_face_destroy (cairo_font_face_t *font_face);
cairo_status_t cairo_font_face_status (cairo_font_face_t *font_face);
cairo_font_type_t cairo_font_face_get_type (cairo_font_face_t *font_face);
unsigned int cairo_font_face_get_reference_count (cairo_font_face_t *font_face);
cairo_status_t cairo_font_face_set_user_data (cairo_font_face_t *font_face, const cairo_user_data_key_t *key, void *user_data, cairo_destroy_func_t destroy);
void * cairo_font_face_get_user_data (cairo_font_face_t *font_face, const cairo_user_data_key_t *key);
typedef struct _cairo_font_face cairo_font_face_t;

cairo_scaled_font_t * cairo_scaled_font_create (cairo_font_face_t *font_face, const cairo_matrix_t *font_matrix, const cairo_matrix_t *ctm, const cairo_font_options_t *options);
cairo_scaled_font_t * cairo_scaled_font_reference (cairo_scaled_font_t *scaled_font);
void cairo_scaled_font_destroy (cairo_scaled_font_t *scaled_font);
cairo_status_t cairo_scaled_font_status (cairo_scaled_font_t *scaled_font);
void cairo_scaled_font_extents (cairo_scaled_font_t *scaled_font, cairo_font_extents_t *extents);
void cairo_scaled_font_text_extents (cairo_scaled_font_t *scaled_font, const char *utf8, cairo_text_extents_t *extents);
void cairo_scaled_font_glyph_extents (cairo_scaled_font_t *scaled_font, const cairo_glyph_t *glyphs, int num_glyphs, cairo_text_extents_t *extents);
cairo_status_t cairo_scaled_font_text_to_glyphs (cairo_scaled_font_t *scaled_font, double x, double y, const char *utf8, int utf8_len, cairo_glyph_t **glyphs, int *num_glyphs, cairo_text_cluster_t **clusters, int *num_clusters, cairo_text_cluster_flags_t *cluster_flags);
cairo_font_face_t * cairo_scaled_font_get_font_face (cairo_scaled_font_t *scaled_font);
void cairo_scaled_font_get_font_options (cairo_scaled_font_t *scaled_font, cairo_font_options_t *options);
void cairo_scaled_font_get_font_matrix (cairo_scaled_font_t *scaled_font, cairo_matrix_t *font_matrix);
void cairo_scaled_font_get_ctm (cairo_scaled_font_t *scaled_font, cairo_matrix_t *ctm);
void cairo_scaled_font_get_scale_matrix (cairo_scaled_font_t *scaled_font, cairo_matrix_t *scale_matrix);
cairo_font_type_t cairo_scaled_font_get_type (cairo_scaled_font_t *scaled_font);
unsigned int cairo_scaled_font_get_reference_count (cairo_scaled_font_t *scaled_font);
cairo_status_t cairo_scaled_font_set_user_data (cairo_scaled_font_t *scaled_font, const cairo_user_data_key_t *key, void *user_data, cairo_destroy_func_t destroy);
void * cairo_scaled_font_get_user_data (cairo_scaled_font_t *scaled_font, const cairo_user_data_key_t *key);
typedef struct _cairo_scaled_font cairo_scaled_font_t;
typedef struct { double ascent; double descent; double height; double max_x_advance; double max_y_advance; } cairo_font_extents_t;
typedef struct { double x_bearing; double y_bearing; double width; double height; double x_advance; double y_advance; } cairo_text_extents_t;

cairo_font_options_t * cairo_font_options_create (void);
cairo_font_options_t * cairo_font_options_copy (const cairo_font_options_t *original);
void cairo_font_options_destroy (cairo_font_options_t *options);
cairo_status_t cairo_font_options_status (cairo_font_options_t *options);
void cairo_font_options_merge (cairo_font_options_t *options, const cairo_font_options_t *other);
unsigned long cairo_font_options_hash (const cairo_font_options_t *options);
cairo_bool_t cairo_font_options_equal (const cairo_font_options_t *options, const cairo_font_options_t *other);
void cairo_font_options_set_antialias (cairo_font_options_t *options, cairo_antialias_t antialias);
cairo_antialias_t cairo_font_options_get_antialias (const cairo_font_options_t *options);
void cairo_font_options_set_subpixel_order (cairo_font_options_t *options, cairo_subpixel_order_t subpixel_order);
cairo_subpixel_order_t cairo_font_options_get_subpixel_order (const cairo_font_options_t *options);
void cairo_font_options_set_hint_style (cairo_font_options_t *options, cairo_hint_style_t hint_style);
cairo_hint_style_t cairo_font_options_get_hint_style (const cairo_font_options_t *options);
void cairo_font_options_set_hint_metrics (cairo_font_options_t *options, cairo_hint_metrics_t hint_metrics);
cairo_hint_metrics_t cairo_font_options_get_hint_metrics (const cairo_font_options_t *options);
const char * cairo_font_options_get_variations (cairo_font_options_t *options);
void cairo_font_options_set_variations (cairo_font_options_t *options, const char *variations);
typedef struct _cairo_font_options cairo_font_options_t;

cairo_font_face_t * cairo_ft_font_face_create_for_ft_face (FT_Face face, int load_flags);
cairo_font_face_t * cairo_ft_font_face_create_for_pattern (FcPattern *pattern);
void cairo_ft_font_options_substitute (const cairo_font_options_t *options, FcPattern *pattern);
FT_Face cairo_ft_scaled_font_lock_face (cairo_scaled_font_t *scaled_font);
void cairo_ft_scaled_font_unlock_face (cairo_scaled_font_t *scaled_font);
unsigned int cairo_ft_font_face_get_synthesize (cairo_font_face_t *font_face);
void cairo_ft_font_face_set_synthesize (cairo_font_face_t *font_face, unsigned int synth_flags);
void cairo_ft_font_face_unset_synthesize (cairo_font_face_t *font_face, unsigned int synth_flags);
#define CAIRO_HAS_FT_FONT 1
#define CAIRO_HAS_FC_FONT 1

cairo_font_face_t * cairo_win32_font_face_create_for_logfontw (LOGFONTW *logfont);
cairo_font_face_t * cairo_win32_font_face_create_for_hfont (HFONT font);
cairo_font_face_t * cairo_win32_font_face_create_for_logfontw_hfont (LOGFONTW *logfont, HFONT font);
cairo_status_t cairo_win32_scaled_font_select_font (cairo_scaled_font_t *scaled_font, HDC hdc);
void cairo_win32_scaled_font_done_font (cairo_scaled_font_t *scaled_font);
double cairo_win32_scaled_font_get_metrics_factor (cairo_scaled_font_t *scaled_font);
void cairo_win32_scaled_font_get_logical_to_device (cairo_scaled_font_t *scaled_font, cairo_matrix_t *logical_to_device);
void cairo_win32_scaled_font_get_device_to_logical (cairo_scaled_font_t *scaled_font, cairo_matrix_t *device_to_logical);
#define CAIRO_HAS_WIN32_FONT 1

cairo_font_face_t * cairo_quartz_font_face_create_for_cgfont (CGFontRef font);
cairo_font_face_t * cairo_quartz_font_face_create_for_atsu_font_id (ATSUFontID font_id);
#define CAIRO_HAS_QUARTZ_FONT 1

cairo_status_t (*cairo_user_scaled_font_init_func_t) (cairo_scaled_font_t *scaled_font, cairo_t *cr, cairo_font_extents_t *extents);
cairo_status_t (*cairo_user_scaled_font_render_glyph_func_t) (cairo_scaled_font_t *scaled_font, unsigned long glyph, cairo_t *cr, cairo_text_extents_t *extents);
cairo_status_t (*cairo_user_scaled_font_text_to_glyphs_func_t) (cairo_scaled_font_t *scaled_font, const char *utf8, int utf8_len, cairo_glyph_t **glyphs, int *num_glyphs, cairo_text_cluster_t **clusters, int *num_clusters, cairo_text_cluster_flags_t *cluster_flags);
cairo_status_t (*cairo_user_scaled_font_unicode_to_glyph_func_t) (cairo_scaled_font_t *scaled_font, unsigned long unicode, unsigned long *glyph_index);
cairo_font_face_t * cairo_user_font_face_create (void);
void cairo_user_font_face_set_init_func (cairo_font_face_t *font_face, cairo_user_scaled_font_init_func_t init_func);
cairo_user_scaled_font_init_func_t cairo_user_font_face_get_init_func (cairo_font_face_t *font_face);
void cairo_user_font_face_set_render_glyph_func (cairo_font_face_t *font_face, cairo_user_scaled_font_render_glyph_func_t render_glyph_func);
cairo_user_scaled_font_render_glyph_func_t cairo_user_font_face_get_render_glyph_func (cairo_font_face_t *font_face);
void cairo_user_font_face_set_unicode_to_glyph_func (cairo_font_face_t *font_face, cairo_user_scaled_font_unicode_to_glyph_func_t unicode_to_glyph_func);
cairo_user_scaled_font_unicode_to_glyph_func_t cairo_user_font_face_get_unicode_to_glyph_func (cairo_font_face_t *font_face);
void cairo_user_font_face_set_text_to_glyphs_func (cairo_font_face_t *font_face, cairo_user_scaled_font_text_to_glyphs_func_t text_to_glyphs_func);
cairo_user_scaled_font_text_to_glyphs_func_t cairo_user_font_face_get_text_to_glyphs_func (cairo_font_face_t *font_face);
#define CAIRO_HAS_USER_FONT 1

cairo_device_t * cairo_device_reference (cairo_device_t *device);
void cairo_device_destroy (cairo_device_t *device);
cairo_status_t cairo_device_status (cairo_device_t *device);
void cairo_device_finish (cairo_device_t *device);
void cairo_device_flush (cairo_device_t *device);
cairo_device_type_t cairo_device_get_type (cairo_device_t *device);
unsigned int cairo_device_get_reference_count (cairo_device_t *device);
cairo_status_t cairo_device_set_user_data (cairo_device_t *device, const cairo_user_data_key_t *key, void *user_data, cairo_destroy_func_t destroy);
void * cairo_device_get_user_data (cairo_device_t *device, const cairo_user_data_key_t *key);
cairo_status_t cairo_device_acquire (cairo_device_t *device);
void cairo_device_release (cairo_device_t *device);
double cairo_device_observer_elapsed (cairo_device_t *device);
double cairo_device_observer_fill_elapsed (cairo_device_t *device);
double cairo_device_observer_glyphs_elapsed (cairo_device_t *device);
double cairo_device_observer_mask_elapsed (cairo_device_t *device);
double cairo_device_observer_paint_elapsed (cairo_device_t *device);
cairo_status_t cairo_device_observer_print (cairo_device_t *device, cairo_write_func_t write_func, void *closure);
double cairo_device_observer_stroke_elapsed (cairo_device_t *device);
typedef struct _cairo_device cairo_device_t;

// XXX(cairo surface not included)

void cairo_matrix_init (cairo_matrix_t *matrix, double xx, double yx, double xy, double yy, double x0, double y0);
void cairo_matrix_init_identity (cairo_matrix_t *matrix);
void cairo_matrix_init_translate (cairo_matrix_t *matrix, double tx, double ty);
void cairo_matrix_init_scale (cairo_matrix_t *matrix, double sx, double sy);
void cairo_matrix_init_rotate (cairo_matrix_t *matrix, double radians);
void cairo_matrix_translate (cairo_matrix_t *matrix, double tx, double ty);
void cairo_matrix_scale (cairo_matrix_t *matrix, double sx, double sy);
void cairo_matrix_rotate (cairo_matrix_t *matrix, double radians);
cairo_status_t cairo_matrix_invert (cairo_matrix_t *matrix);
void cairo_matrix_multiply (cairo_matrix_t *result, const cairo_matrix_t *a, const cairo_matrix_t *b);
void cairo_matrix_transform_distance (const cairo_matrix_t *matrix, double *dx, double *dy);
void cairo_matrix_transform_point (const cairo_matrix_t *matrix, double *x, double *y);
typedef struct { double xx; double yx; double xy; double yy; double x0; double y0; } cairo_matrix_t;

const char * cairo_status_to_string (cairo_status_t status);
void cairo_debug_reset_static_data (void);

void (*cairo_destroy_func_t) (void *data);
typedef int cairo_bool_t;
typedef struct { int unused; } cairo_user_data_key_t;
typedef struct { int x, y; int width, height; } cairo_rectangle_int_t;

*/
