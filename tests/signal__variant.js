/*
 * signal__variant.js
 *
 * A GVariant marshalled INTO a signal handler (e.g. the parameter of
 * Gio.SimpleAction::activate / ::change-state) must arrive as a valid,
 * readable variant, not a wrapper pointing at NULL (#465). GVariant is a
 * refcounted fundamental type, not a boxed type, so it needs
 * g_variant_ref/unref rather than g_boxed_copy/free.
 */

const gi = require('../lib/')
const GLib = gi.require('GLib', '2.0')
const Gio = gi.require('Gio', '2.0')
const { describe, it, assert, expect } = require('./__common__.js')

const gc = global.gc || (() => {})

describe('GVariant passed into a signal handler', () => {

  it('is readable inside the handler (the #465 repro)', () => {
    const action = Gio.SimpleAction.new('t', GLib.VariantType.new('s'))
    let seen = null
    action.on('activate', (parameter) => {
      seen = parameter.getString()[0]
    })

    const v = GLib.Variant.newString('hello-world')
    expect(v.getString()[0], 'hello-world')  // JS-side read
    action.activate(v)
    expect(seen, 'hello-world')              // read inside the handler
  })

  it('gives the handler its own reference that outlives the emission', () => {
    const action = Gio.SimpleAction.new('u', GLib.VariantType.new('s'))
    let captured = null
    action.on('activate', (parameter) => { captured = parameter })

    action.activate(GLib.Variant.newString('kept-alive'))
    gc()

    assert(captured instanceof GLib.Variant, 'captured is a GLib.Variant')
    expect(captured.getString()[0], 'kept-alive')
  })

  it('carries the requested value into ::change-state', () => {
    const action = Gio.SimpleAction.newStateful(
      's', GLib.VariantType.new('s'), GLib.Variant.newString('a'))
    let requested = null
    action.on('change-state', (value) => {
      requested = value.getString()[0]
      action.setState(value)  // exercises writing a variant back out (V8ToGValue)
    })

    action.changeState(GLib.Variant.newString('b'))
    expect(requested, 'b')
    expect(action.getState().getString()[0], 'b')
  })

  it('does not leak or double-free across many round-trips + GC', () => {
    const action = Gio.SimpleAction.new('r', GLib.VariantType.new('s'))
    let seen = null
    action.on('activate', (parameter) => { seen = parameter.getString()[0] })

    for (let i = 0; i < 2000; i++) {
      action.activate(GLib.Variant.newString('value-' + i))
      expect(seen, 'value-' + i)
      if (i % 100 === 0)
        gc()
    }
    gc()
  })
})

describe('GVariant as a GObject property', () => {

  it('reads back through the GValue path (GValueToV8)', () => {
    const action = Gio.SimpleAction.newStateful(
      'g', GLib.VariantType.new('s'), GLib.Variant.newString('hello'))
    assert(action.state instanceof GLib.Variant, 'state is a GLib.Variant')
    expect(action.state.getString()[0], 'hello')
  })

  it('sets at construction through the GValue path (V8ToGValue)', () => {
    const action = new Gio.SimpleAction({
      name: 'c',
      state: GLib.Variant.newString('constructed'),
    })
    expect(action.state.getString()[0], 'constructed')
    gc()
    expect(action.state.getString()[0], 'constructed')
  })
})
