/*
 * GObject.js
 */

const internal = require('../native.js')
const system = internal.System


exports.apply = (GObject) => {

  /*
   * GObject
   */

  GObject.TYPE_INVALID   = 0n
  GObject.TYPE_NONE      = GObject.typeFromName('void')
  GObject.TYPE_INTERFACE = GObject.typeFromName('GInterface')
  GObject.TYPE_CHAR      = GObject.typeFromName('gchar')
  GObject.TYPE_UCHAR     = GObject.typeFromName('guchar')
  GObject.TYPE_BOOLEAN   = GObject.typeFromName('gboolean')
  GObject.TYPE_INT       = GObject.typeFromName('gint')
  GObject.TYPE_UINT      = GObject.typeFromName('guint')
  GObject.TYPE_LONG      = GObject.typeFromName('glong')
  GObject.TYPE_ULONG     = GObject.typeFromName('gulong')
  GObject.TYPE_INT64     = GObject.typeFromName('gint64')
  GObject.TYPE_UINT64    = GObject.typeFromName('guint64')
  GObject.TYPE_ENUM      = GObject.typeFromName('GEnum')
  GObject.TYPE_FLAGS     = GObject.typeFromName('GFlags')
  GObject.TYPE_FLOAT     = GObject.typeFromName('gfloat')
  GObject.TYPE_DOUBLE    = GObject.typeFromName('gdouble')
  GObject.TYPE_STRING    = GObject.typeFromName('gchararray')
  GObject.TYPE_POINTER   = GObject.typeFromName('gpointer')
  GObject.TYPE_BOXED     = GObject.typeFromName('GBoxed')
  GObject.TYPE_PARAM     = GObject.typeFromName('GParam')
  GObject.TYPE_OBJECT    = GObject.typeFromName('GObject')
  GObject.TYPE_GTYPE     = GObject.typeFromName('GType')
  GObject.TYPE_VARIANT   = GObject.typeFromName('GVariant')
  GObject.TYPE_UNICHAR   = GObject.TYPE_UINT


  GObject.Object.prototype._setProperty = GObject.Object.prototype.setProperty
  GObject.Object.prototype.setProperty = function (name, value) {
    internal.ObjectPropertySetter(this, name, value)
  }
  GObject.Object.prototype._getProperty = GObject.Object.prototype.getProperty
  GObject.Object.prototype.getProperty = function (name) {
    return internal.ObjectPropertyGetter(this, name)
  }

  GObject.Value.prototype.getBoxed = function getBoxed() {
    return system.convertGValue(this)
  }
}
