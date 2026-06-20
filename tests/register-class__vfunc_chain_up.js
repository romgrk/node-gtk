/*
 * register-class__vfunc_chain_up.js
 *
 * A vfunc override replaces the parent's implementation in the class vtable, so
 * without help a JS subclass cannot call the implementation it overrode. We make
 * the idiomatic `super.<vfunc>()` reach it: `registerClass` installs, on the
 * parent GI class's prototype, a bridge that invokes the *parent's* native vfunc
 * implementation (resolved through the parent GType, not the overriding subclass).
 *
 * Note: this works for "pure" vfuncs — ones without a public invoker method of
 * the same name (e.g. snapshot_line, query_data, constructed). For invoker-backed
 * vfuncs (e.g. get_request_mode, which the prototype already exposes as a method
 * that dispatches virtually) `super.<name>()` resolves to that invoker and would
 * recurse, so it is intentionally not bridged.
 *
 * Chain-up needs a fully-constructed instance: it is invoked here from a regular
 * method (post-construction), not from `constructed` itself, since that fires
 * inside g_object_new before the JS wrapper is associated with its GObject.
 */

const { describe, it, expect } = require('./__common__')

const gi = require('..')
const GObject = gi.require('GObject')

describe('registerClass vfunc chain-up', () => {

  it('reaches the native parent impl through nested JS overrides via super', () => {
    const order = []

    class A extends GObject.Object {
      static GTypeName = 'NodeGTKChainA'
      // Overriding `constructed` registers the override (and installs the bridge);
      // kept a no-op so construction itself doesn't chain (the wrapper isn't
      // associated yet during g_object_new).
      constructed() {}
      // Idiomatic chain-up, invoked when WE choose — the instance is live by then.
      chain() {
        order.push('A:before')
        super.constructed()   // -> native GObject.Object.constructed (the bridge)
        order.push('A:after')
      }
    }
    gi.registerClass(A)

    class B extends A {
      static GTypeName = 'NodeGTKChainB'
      chain() {
        order.push('B:before')
        super.chain()         // -> A.prototype.chain (a plain JS method)
        order.push('B:after')
      }
    }
    gi.registerClass(B)

    // The bridge for a pure vfunc lands on the native parent prototype.
    expect(typeof GObject.Object.prototype.constructed, 'function')

    const b = new B()
    b.chain()

    // B's super hits A's JS method; A's super hits GObject's native constructed.
    // Correct LIFO nesting proves the chain dispatched once at each level without
    // recursing or throwing.
    expect(order, ['B:before', 'A:before', 'A:after', 'B:after'])
  })
})
