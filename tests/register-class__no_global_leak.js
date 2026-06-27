/*
 * register-class__no_global_leak.js
 *
 * Regression test: registering a class must not leak an implicit global.
 * findVFuncOnInterfaces() used `for (i = 0; ...)` with an undeclared `i`,
 * which (in non-strict module scope) created a `global.i`.
 */

const { describe, it, expect } = require('./__common__')

const gi = require('..')
const Gtk = gi.require('Gtk', '3.0'); Gtk.init([])

describe('registerClass', () => {
  it('does not leak an implicit global `i`', () => {
    // Clear any pre-existing value so we measure only our registration.
    delete global.i

    class NoLeakWidget extends Gtk.Widget {
      static GTypeName = 'NodeGTKNoLeakWidget'
      // A virtual_* method whose vfunc is on neither the parents nor the
      // interfaces forces findVFuncOnInterfaces() to run (the path that leaked).
      virtual_notARealVfunc() {}
    }

    // registerClass now throws for an unresolved virtual_* name; the global-leak
    // check is what this test guards, so swallow the throw.
    try { gi.registerClass(NoLeakWidget) } catch (e) {}

    expect('i' in global, false)
  })
})
