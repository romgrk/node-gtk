/*
 * conversion__gvalue_autobox.js
 *
 * A GValue-typed method parameter accepts a raw JS value: it is auto-boxed
 * into a temporary GValue, as GJS does (#469). The GValue type is guessed
 * from the JS value (boolean/int/double/string, or the wrapped instance's
 * own GType), and callees relying on g_value_transform (e.g.
 * g_object_set_property, adw_breakpoint_add_setter) coerce it to the exact
 * property type from there.
 */

const gi = require('../lib/')
const GObject = gi.require('GObject', '2.0')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const Pango = gi.require('Pango')
const { describe, expect, it, mustThrow } = require('./__common__.js')

Gtk.init([])

// GObject.Object.prototype._setProperty is the raw introspected
// g_object_set_property(name, GValue) method (the unprefixed setProperty is
// overridden in lib/overrides/GObject.js and doesn't take a GValue).

describe('GValue-typed parameters auto-box raw JS values', () => {
  const label = new Gtk.Label()

  it('boxes a boolean', () => {
    label._setProperty('visible', true)
    expect(label.visible, true)
  })

  it('boxes an integer number', () => {
    label._setProperty('lines', 3)
    expect(label.lines, 3)
  })

  it('boxes a float number', () => {
    label._setProperty('angle', 45.5)
    expect(label.angle, 45.5)
  })

  it('boxes a string', () => {
    label._setProperty('label', 'hello')
    expect(label.label, 'hello')
  })

  it('boxes an enum value', () => {
    label._setProperty('justify', Gtk.Justification.RIGHT)
    expect(label.justify, Gtk.Justification.RIGHT)
  })

  it('boxes a flags value', () => {
    // GtkLabel is a no-window widget and won't retain 'events'.
    const box = new Gtk.EventBox()
    box._setProperty('events', Gdk.EventMask.KEY_PRESS_MASK)
    expect(box.events, Gdk.EventMask.KEY_PRESS_MASK)
  })

  it('boxes a GObject instance', () => {
    const other = new Gtk.Label()
    label._setProperty('mnemonic-widget', other)
    expect(label.mnemonicWidget === other, true)
  })

  it('boxes a boxed instance', () => {
    const attrs = new Pango.AttrList()
    attrs.insert(Pango.attrScaleNew(2))
    label._setProperty('attributes', attrs)
    expect(label.attributes instanceof Pango.AttrList, true)
  })

  it('still accepts an explicit GObject.Value', () => {
    const value = new GObject.Value()
    value.init(GObject.TYPE_BOOLEAN)
    value.setBoolean(false)
    label._setProperty('visible', value)
    expect(label.visible, false)
  })

  it('works through Gtk.ListStore.setValue', () => {
    const store = new Gtk.ListStore()
    store.setColumnTypes([GObject.TYPE_STRING, GObject.TYPE_INT, GObject.TYPE_BOOLEAN, GObject.TYPE_DOUBLE])
    const iter = store.append()
    store.setValue(iter, 0, 'world')
    store.setValue(iter, 1, 42)
    store.setValue(iter, 2, true)
    store.setValue(iter, 3, 3.25)
    expect(store.getValue(iter, 0).getString(), 'world')
    expect(store.getValue(iter, 1).getInt(), 42)
    expect(store.getValue(iter, 2).getBoolean(), true)
    expect(store.getValue(iter, 3).getDouble(), 3.25)
  })

  it('rejects a value it cannot box',
    mustThrow(/Expected argument of type GObject.Value for parameter value/, () => {
      label._setProperty('visible', {})
    }))
})
