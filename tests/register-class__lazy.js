/*
 * register-class__lazy.js
 *
 * registerClass() is optional: the first `new Subclass()` of an unregistered JS
 * subclass registers it on demand (see GObjectConstructor in src/gobject.cc).
 * Without this, constructing an unregistered subclass would silently instantiate
 * its nearest registered ancestor, losing the subtype and any vfunc overrides.
 */

const { describe, it, expect, skip } = require('./__common__')

const gi = require('..')
const GObject = gi.require('GObject')

describe('registerClass (lazy)', () => {

  it('registers a subclass on first construction, no registerClass() call', () => {
    class LazyWidget extends GObject.Object {
      static GTypeName = 'NodeGTKLazyWidget'
    }

    // No gi.registerClass(LazyWidget) here.
    const w = new LazyWidget()

    expect(w instanceof LazyWidget, true)
    expect(w instanceof GObject.Object, true)
    // The instance is the subtype, not the parent that __gtype__ is inherited from.
    expect(GObject.typeName(w.__gtype__), 'NodeGTKLazyWidget')
  })

  it('lazily registers an unregistered ancestor chain', () => {
    class LazyBase extends GObject.Object {
      static GTypeName = 'NodeGTKLazyBase'
    }
    class LazySub extends LazyBase {
      static GTypeName = 'NodeGTKLazySub'
    }

    // Construct the leaf without registering either class: both register.
    const sub = new LazySub()

    expect(sub instanceof LazyBase, true)
    expect(GObject.typeName(sub.__gtype__), 'NodeGTKLazySub')
    expect(GObject.typeFromName('NodeGTKLazyBase') !== GObject.TYPE_INVALID, true)
  })

  it('installs vfunc overrides through the lazy path', () => {
    // chain-up (g_vfunc_info_invoke) crashes on macOS — see issue #453.
    if (process.platform === 'darwin')
      skip()

    const order = []

    class LazyA extends GObject.Object {
      static GTypeName = 'NodeGTKLazyChainA'
      constructed() {}                 // registers the override + parent bridge
      chain() {
        order.push('A:before')
        super.constructed()            // -> native GObject.Object.constructed
        order.push('A:after')
      }
    }
    class LazyB extends LazyA {
      static GTypeName = 'NodeGTKLazyChainB'
      chain() {
        order.push('B:before')
        super.chain()                  // -> LazyA.prototype.chain
        order.push('B:after')
      }
    }

    // First construction registers both LazyB and LazyA (vfuncs included).
    const b = new LazyB()
    expect(typeof GObject.Object.prototype.constructed, 'function')

    b.chain()
    expect(order, ['B:before', 'A:before', 'A:after', 'B:after'])
  })

  it('a redundant registerClass() after construction is a no-op', () => {
    class LazyIdempotent extends GObject.Object {
      static GTypeName = 'NodeGTKLazyIdempotent'
    }

    const a = new LazyIdempotent()
    // Already registered by construction; this must not throw "already registerd".
    expect(gi.registerClass(LazyIdempotent), LazyIdempotent)
    const b = new LazyIdempotent()

    expect(a.__gtype__, b.__gtype__)
  })
})
