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
      // A method whose snake_case name is not a parent vfunc forces
      // findVFuncOnInterfaces() to run.
      someCustomMethod() {}
    }

    gi.registerClass(NoLeakWidget)

    expect('i' in global, false)
  })
})
