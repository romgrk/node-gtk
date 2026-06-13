/*
 * object__get_gtype.js
 *
 * gi.getGType() returns the GType of a class, an instance, or a GType (#286).
 */

const gi = require('../lib')
const GObject = gi.require('GObject', '2.0')
const Gtk = gi.require('Gtk', '3.0')
const { describe, it, expect, assert, mustThrow } = require('./__common__.js')

Gtk.init([])

describe('getGType', () => {
  const win = new Gtk.Window()
  const classGType = gi.getGType(Gtk.Window)

  it('returns the same GType for a class and its instance', () => {
    assert(typeof classGType === 'bigint', 'GType should be a BigInt')
    expect(gi.getGType(win), classGType)
  })

  it('resolves to the correct GObject type name', () => {
    expect(GObject.typeName(classGType), 'GtkWindow')
  })

  it('passes a GType through unchanged', () => {
    expect(gi.getGType(classGType), classGType)
  })

  it('throws for a value with no GType', mustThrow(
    /expected a GObject\/boxed class, instance, or GType/,
    () => { gi.getGType({}) }
  ))
})
