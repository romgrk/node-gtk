/*
 * register-class__deferred.js
 *
 * registerClass() accumulates calls whose parent GType isn't registered yet and
 * flushes them once the parent registers, so registration is order-independent.
 * Previously, registering a subclass before its superclass threw
 * `Parent class not registered`.
 */

const { describe, it, expect } = require('./__common__')

const gi = require('..')
const GObject = gi.require('GObject')
const Gtk = gi.require('Gtk', '3.0'); Gtk.init([])

describe('registerClass (deferred)', () => {

  it('registers a subclass declared before its superclass', () => {
    class DeferBase extends Gtk.Widget {
      static GTypeName = 'NodeGTKDeferBase'
    }
    class DeferSub extends DeferBase {
      static GTypeName = 'NodeGTKDeferSub'
    }

    // Register the subclass FIRST: its parent (DeferBase) isn't registered yet,
    // so this must not throw — it is deferred.
    gi.registerClass(DeferSub)

    // Registering the parent flushes the pending subclass.
    gi.registerClass(DeferBase)

    const base = new DeferBase()
    const sub = new DeferSub()
    expect(base instanceof Gtk.Widget, true)
    expect(sub instanceof Gtk.Widget, true)
    expect(GObject.typeName(base.__gtype__), 'NodeGTKDeferBase')
    expect(GObject.typeName(sub.__gtype__), 'NodeGTKDeferSub')
  })

  it('returns the class so it can be assigned / used as a decorator', () => {
    class DeferReturned extends Gtk.Widget {
      static GTypeName = 'NodeGTKDeferReturned'
    }
    expect(gi.registerClass(DeferReturned), DeferReturned)
  })
})
