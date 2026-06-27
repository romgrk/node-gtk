/*
 * conversion__boxed_explicit_unref.js
 *
 * Regression test for #429: calling an introspected method that frees the
 * instance itself (e.g. GLib.MainLoop's *_unref) must make node-gtk's wrapper
 * relinquish ownership, so the GC finalizer doesn't free the same memory a
 * second time. The double-free is a benign warning on lenient allocators but a
 * hard SIGSEGV with the loop integration active on libffi 3.5 (Ubuntu 26).
 *
 * Run with --expose-gc (the runner does).
 */

const gi = require('../lib/')
const GLib = gi.require('GLib', '2.0')
const { describe, assert } = require('./__common__.js')

assert(typeof global.gc === 'function', 'test must run with --expose-gc')

describe('explicit unref() of a boxed disowns the wrapper (#429)', () => {
  // node-gtk owns the MainLoop's reference; calling unref() drops it. Without
  // disowning, the GC finalizer would unref it again -> double free.
  let loop = new GLib.MainLoop(null, false)
  loop.unref()

  loop = null
  global.gc()
  global.gc()

  // Reaching here without aborting is the assertion.
  assert(true, 'survived GC after explicit unref()')
})
