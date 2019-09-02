
#include <cairo.h>

#include "context.h"
#include "matrix.h"
#include "path.h"
#include "text-extents.h"
#include "font-extents.h"
#include "font-face.h"
#include "font-options.h"
#include "glyph.h"
#include "pattern.h"
#include "scaled-font.h"
#include "surface.h"
#include "text-cluster.h"
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


static Nan::Persistent<v8::FunctionTemplate> constructorTemplate;


/* auto-generated */

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
  Local<Value> args[] = { Nan::New<External> (result) };
  Local<Function> constructor = Nan::New<Function> (Surface::constructor);
  Local<Value> returnValue = Nan::NewInstance(constructor, 1, args).ToLocalChecked();
  info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(pushGroup) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // function call
  cairo_push_group (cr);
}

NAN_METHOD(pushGroupWithContent) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto content = (cairo_content_t) Nan::To<int64_t>(info[0].As<Number>()).ToChecked();

  // function call
  cairo_push_group_with_content (cr, content);
}

NAN_METHOD(popGroup) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // function call
  cairo_pattern_t * result = cairo_pop_group (cr);

  // return
  Local<Value> args[] = { Nan::New<External> (result) };
  Local<Function> constructor = Nan::New<Function> (Pattern::constructor);
  Local<Value> returnValue = Nan::NewInstance(constructor, 1, args).ToLocalChecked();
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
  Local<Value> args[] = { Nan::New<External> (result) };
  Local<Function> constructor = Nan::New<Function> (Surface::constructor);
  Local<Value> returnValue = Nan::NewInstance(constructor, 1, args).ToLocalChecked();
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

NAN_METHOD(setSource) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto source = Nan::ObjectWrap::Unwrap<Pattern>(info[0].As<Object>())->_data;

  // function call
  cairo_set_source (cr, source);
}

NAN_METHOD(setSourceSurface) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto surface = Nan::ObjectWrap::Unwrap<Surface>(info[0].As<Object>())->_data;
  auto x = Nan::To<double>(info[1].As<Number>()).ToChecked();
  auto y = Nan::To<double>(info[2].As<Number>()).ToChecked();

  // function call
  cairo_set_source_surface (cr, surface, x, y);
}

NAN_METHOD(getSource) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // function call
  cairo_pattern_t * result = cairo_get_source (cr);

  // return
  Local<Value> args[] = { Nan::New<External> (result) };
  Local<Function> constructor = Nan::New<Function> (Pattern::constructor);
  Local<Value> returnValue = Nan::NewInstance(constructor, 1, args).ToLocalChecked();
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
  Local<Value> returnValue = Nan::New ((bool) result);
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
  Local<Value> returnValue = Nan::New ((bool) result);
  info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(mask) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto pattern = Nan::ObjectWrap::Unwrap<Pattern>(info[0].As<Object>())->_data;

  // function call
  cairo_mask (cr, pattern);
}

NAN_METHOD(maskSurface) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto surface = Nan::ObjectWrap::Unwrap<Surface>(info[0].As<Object>())->_data;
  auto surface_x = Nan::To<double>(info[1].As<Number>()).ToChecked();
  auto surface_y = Nan::To<double>(info[2].As<Number>()).ToChecked();

  // function call
  cairo_mask_surface (cr, surface, surface_x, surface_y);
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
  Local<Value> returnValue = Nan::New ((bool) result);
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
  Local<Value> args[] = { Nan::New<External> (result) };
  Local<Function> constructor = Nan::New<Function> (Path::constructor);
  Local<Value> returnValue = Nan::NewInstance(constructor, 1, args).ToLocalChecked();
  info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(copyPathFlat) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // function call
  cairo_path_t * result = cairo_copy_path_flat (cr);

  // return
  Local<Value> args[] = { Nan::New<External> (result) };
  Local<Function> constructor = Nan::New<Function> (Path::constructor);
  Local<Value> returnValue = Nan::NewInstance(constructor, 1, args).ToLocalChecked();
  info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(appendPath) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto path = Nan::ObjectWrap::Unwrap<Path>(info[0].As<Object>())->_data;

  // function call
  cairo_append_path (cr, path);
}

NAN_METHOD(hasCurrentPoint) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // function call
  cairo_bool_t result = cairo_has_current_point (cr);

  // return
  Local<Value> returnValue = Nan::New ((bool) result);
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

NAN_METHOD(glyphPath) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto glyphs = Nan::ObjectWrap::Unwrap<Glyph>(info[0].As<Object>())->_data;
  auto num_glyphs = Nan::To<int64_t>(info[1].As<Number>()).ToChecked();

  // function call
  cairo_glyph_path (cr, glyphs, num_glyphs);
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

NAN_METHOD(showGlyphs) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto glyphs = Nan::ObjectWrap::Unwrap<Glyph>(info[0].As<Object>())->_data;
  auto num_glyphs = Nan::To<int64_t>(info[1].As<Number>()).ToChecked();

  // function call
  cairo_show_glyphs (cr, glyphs, num_glyphs);
}

NAN_METHOD(showTextGlyphs) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto utf8 = *Nan::Utf8String (info[0].As<String>());
  auto utf8_len = Nan::To<int64_t>(info[1].As<Number>()).ToChecked();
  auto glyphs = Nan::ObjectWrap::Unwrap<Glyph>(info[2].As<Object>())->_data;
  auto num_glyphs = Nan::To<int64_t>(info[3].As<Number>()).ToChecked();
  auto clusters = Nan::ObjectWrap::Unwrap<TextCluster>(info[4].As<Object>())->_data;
  auto num_clusters = Nan::To<int64_t>(info[5].As<Number>()).ToChecked();
  auto cluster_flags = (cairo_text_cluster_flags_t) Nan::To<int64_t>(info[6].As<Number>()).ToChecked();

  // function call
  cairo_show_text_glyphs (cr, utf8, utf8_len, glyphs, num_glyphs, clusters, num_clusters, cluster_flags);
}

NAN_METHOD(fontExtents) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // out-arguments
  auto extents = Nan::NewInstance(
          Nan::New<Function>(FontExtents::constructor),
          0,
          NULL).ToLocalChecked();

  // function call
  cairo_font_extents (cr, Nan::ObjectWrap::Unwrap<FontExtents>(extents)->_data);

  // return
  Local<Value> returnValue = extents;
  info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(textExtents) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto utf8 = *Nan::Utf8String (info[0].As<String>());

  // out-arguments
  auto extents = Nan::NewInstance(
          Nan::New<Function>(TextExtents::constructor),
          0,
          NULL).ToLocalChecked();

  // function call
  cairo_text_extents (cr, utf8, Nan::ObjectWrap::Unwrap<TextExtents>(extents)->_data);

  // return
  Local<Value> returnValue = extents;
  info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(glyphExtents) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto glyphs = Nan::ObjectWrap::Unwrap<Glyph>(info[0].As<Object>())->_data;
  auto num_glyphs = Nan::To<int64_t>(info[1].As<Number>()).ToChecked();

  // out-arguments
  auto extents = Nan::NewInstance(
          Nan::New<Function>(TextExtents::constructor),
          0,
          NULL).ToLocalChecked();

  // function call
  cairo_glyph_extents (cr, glyphs, num_glyphs, Nan::ObjectWrap::Unwrap<TextExtents>(extents)->_data);

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

NAN_METHOD(setFontMatrix) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto matrix = Nan::ObjectWrap::Unwrap<Matrix>(info[0].As<Object>())->_data;

  // function call
  cairo_set_font_matrix (cr, matrix);
}

NAN_METHOD(getFontMatrix) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // out-arguments
  auto matrix = Nan::NewInstance(
          Nan::New<Function>(Matrix::constructor),
          0,
          NULL).ToLocalChecked();

  // function call
  cairo_get_font_matrix (cr, Nan::ObjectWrap::Unwrap<Matrix>(matrix)->_data);

  // return
  Local<Value> returnValue = matrix;
  info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(setFontOptions) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto options = Nan::ObjectWrap::Unwrap<FontOptions>(info[0].As<Object>())->_data;

  // function call
  cairo_set_font_options (cr, options);
}

NAN_METHOD(getFontOptions) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto options = Nan::ObjectWrap::Unwrap<FontOptions>(info[0].As<Object>())->_data;

  // function call
  cairo_get_font_options (cr, options);
}

NAN_METHOD(setFontFace) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto font_face = Nan::ObjectWrap::Unwrap<FontFace>(info[0].As<Object>())->_data;

  // function call
  cairo_set_font_face (cr, font_face);
}

NAN_METHOD(getFontFace) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // function call
  cairo_font_face_t * result = cairo_get_font_face (cr);

  // return
  Local<Value> args[] = { Nan::New<External> (result) };
  Local<Function> constructor = Nan::New<Function> (FontFace::constructor);
  Local<Value> returnValue = Nan::NewInstance(constructor, 1, args).ToLocalChecked();
  info.GetReturnValue().Set(returnValue);
}

NAN_METHOD(setScaledFont) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto scaled_font = Nan::ObjectWrap::Unwrap<ScaledFont>(info[0].As<Object>())->_data;

  // function call
  cairo_set_scaled_font (cr, scaled_font);
}

NAN_METHOD(getScaledFont) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // function call
  cairo_scaled_font_t * result = cairo_get_scaled_font (cr);

  // return
  Local<Value> args[] = { Nan::New<External> (result) };
  Local<Function> constructor = Nan::New<Function> (ScaledFont::constructor);
  Local<Value> returnValue = Nan::NewInstance(constructor, 1, args).ToLocalChecked();
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

NAN_METHOD(transform) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto matrix = Nan::ObjectWrap::Unwrap<Matrix>(info[0].As<Object>())->_data;

  // function call
  cairo_transform (cr, matrix);
}

NAN_METHOD(setMatrix) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto matrix = Nan::ObjectWrap::Unwrap<Matrix>(info[0].As<Object>())->_data;

  // function call
  cairo_set_matrix (cr, matrix);
}

NAN_METHOD(getMatrix) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // out-arguments
  auto matrix = Nan::NewInstance(
          Nan::New<Function>(Matrix::constructor),
          0,
          NULL).ToLocalChecked();

  // function call
  cairo_get_matrix (cr, Nan::ObjectWrap::Unwrap<Matrix>(matrix)->_data);

  // return
  Local<Value> returnValue = matrix;
  info.GetReturnValue().Set(returnValue);
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

#if CAIRO_VERSION_MAJOR >= 1 && CAIRO_VERSION_MINOR >= 16
NAN_METHOD(tagBegin) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto tag_name = *Nan::Utf8String (info[0].As<String>());
  auto attributes = *Nan::Utf8String (info[1].As<String>());

  // function call
  cairo_tag_begin (cr, tag_name, attributes);
}
#endif

#if CAIRO_VERSION_MAJOR >= 1 && CAIRO_VERSION_MINOR >= 16
NAN_METHOD(tagEnd) {
  auto self = info.This();
  auto cr = (cairo_t *) self->GetAlignedPointerFromInternalField (0);

  // in-arguments
  auto tag_name = *Nan::Utf8String (info[0].As<String>());

  // function call
  cairo_tag_end (cr, tag_name);
}
#endif

#define SET_METHOD(tpl, name) Nan::SetPrototypeMethod(tpl, #name, name)

static void AttachMethods(Local<FunctionTemplate> tpl) {
  SET_METHOD(tpl, status);
  SET_METHOD(tpl, save);
  SET_METHOD(tpl, restore);
  SET_METHOD(tpl, getTarget);
  SET_METHOD(tpl, pushGroup);
  SET_METHOD(tpl, pushGroupWithContent);
  SET_METHOD(tpl, popGroup);
  SET_METHOD(tpl, popGroupToSource);
  SET_METHOD(tpl, getGroupTarget);
  SET_METHOD(tpl, setSourceRgb);
  SET_METHOD(tpl, setSourceRgba);
  SET_METHOD(tpl, setSource);
  SET_METHOD(tpl, setSourceSurface);
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
  SET_METHOD(tpl, mask);
  SET_METHOD(tpl, maskSurface);
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
  SET_METHOD(tpl, appendPath);
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
  SET_METHOD(tpl, glyphPath);
  SET_METHOD(tpl, textPath);
  SET_METHOD(tpl, relCurveTo);
  SET_METHOD(tpl, relLineTo);
  SET_METHOD(tpl, relMoveTo);
  SET_METHOD(tpl, pathExtents);
  SET_METHOD(tpl, showText);
  SET_METHOD(tpl, showGlyphs);
  SET_METHOD(tpl, showTextGlyphs);
  SET_METHOD(tpl, fontExtents);
  SET_METHOD(tpl, textExtents);
  SET_METHOD(tpl, glyphExtents);
  SET_METHOD(tpl, selectFontFace);
  SET_METHOD(tpl, setFontSize);
  SET_METHOD(tpl, setFontMatrix);
  SET_METHOD(tpl, getFontMatrix);
  SET_METHOD(tpl, setFontOptions);
  SET_METHOD(tpl, getFontOptions);
  SET_METHOD(tpl, setFontFace);
  SET_METHOD(tpl, getFontFace);
  SET_METHOD(tpl, setScaledFont);
  SET_METHOD(tpl, getScaledFont);
  SET_METHOD(tpl, translate);
  SET_METHOD(tpl, scale);
  SET_METHOD(tpl, rotate);
  SET_METHOD(tpl, transform);
  SET_METHOD(tpl, setMatrix);
  SET_METHOD(tpl, getMatrix);
  SET_METHOD(tpl, identityMatrix);
  SET_METHOD(tpl, userToDevice);
  SET_METHOD(tpl, userToDeviceDistance);
  SET_METHOD(tpl, deviceToUser);
  SET_METHOD(tpl, deviceToUserDistance);
  #if CAIRO_VERSION_MAJOR >= 1 && CAIRO_VERSION_MINOR >= 16
  SET_METHOD(tpl, tagBegin);
  #endif
  #if CAIRO_VERSION_MAJOR >= 1 && CAIRO_VERSION_MINOR >= 16
  SET_METHOD(tpl, tagEnd);
  #endif
}

#undef SET_METHOD

/* </ auto-generated */

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

    } else if (info[0]->IsObject ()) {
        /* User code calling `new Cairo.Context(surface)` */

        auto surface = Nan::ObjectWrap::Unwrap<Surface>(info[0].As<Object>())->_data;
        context = cairo_create (surface);

    } else {
        Nan::ThrowTypeError("Missing argument (surface)");
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
    if (!constructorTemplate.IsEmpty())
      return Nan::New<FunctionTemplate> (constructorTemplate);

    auto tpl = Nan::New<FunctionTemplate> (InstanceConstructor);
    tpl->InstanceTemplate()->SetInternalFieldCount(1);
    tpl->SetClassName (UTF8("CairoContext"));
    AttachMethods (tpl);

    constructorTemplate.Reset(tpl);

    return tpl;
}



}; // Context

}; // Cairo

}; // GnodeJS
