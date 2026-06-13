/*
 * boxed__initialization.js
 */


const gi = require('../lib/')
const Gdk = gi.require('Gdk', '3.0')
const Pango = gi.require('Pango')
const { describe, it, mustThrow, expect, assert, skip } = require('./__common__.js')

Gdk.init([])


describe('Boxed initialization', () => {

  it('works for zero-args constructor', () => {
    const color = new Gdk.RGBA()
    expect(color.toString(), 'rgba(0,0,0,0)')
  })

  it('works with object initializer', () => {
    const color = new Gdk.RGBA({ red: 0.5, blue: 0.5, green: 0.5, alpha: 0.5 })
    expect(color.toString(), 'rgba(128,128,128,0.5)')
  })

  it('allocates and frees boxeds with a matching allocator (#290, #213)', () => {
    // GdkRGBA has no introspectable constructor, so `new` allocates the
    // backing memory itself and BoxedDestroyed frees it with g_boxed_free
    // (g_slice_free). Allocating with the wrong allocator corrupts GSlice and
    // aborts after a while ("GSlice: assertion failed: n_allocated > 0") on
    // GLib builds where GSlice is a real slab allocator. Churn many instances
    // through GC to exercise the path.
    for (let i = 0; i < 100000; i++) {
      new Gdk.RGBA({ red: 1, green: 0.5, blue: 0.2, alpha: 1 })
      if (i % 1000 === 0 && typeof global.gc === 'function')
        global.gc()
    }
    if (typeof global.gc === 'function')
      global.gc()
  })

  /*
   * FIXME: For some reason, Pango.AttrSize doesn't work in Github Actions :/
   *        This should be revisited in 3-6 months.
   */
  if (process.env.CI === 'true') {
    skip()
  }

  it('works with non-zero-args constructor', () => {
    const attr = new Pango.AttrSize(10)
    assert(attr instanceof Pango.AttrSize, 'attr isnt an instance of Pango.AttrSize')
    expect(attr.size, 10)
  })

  it('fails with non-zero-args constructor and bad arguments',
    mustThrow("Expected argument of type Number for parameter size, got 'abc'", () => {
      const attr = new Pango.AttrSize('abc')
    }))
})
