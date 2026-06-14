/*
 * object__wrapper_resurrect.js
 *
 * Regression test for a use-after-free in WrapperFromGObject. When a GObject
 * wrapper goes out of JS scope, V8 GC zaps the Persistent handle and schedules
 * the destroy callback. With the previous single-pass callback, the GObject's
 * qdata still pointed at the (now zapped) wrapper during the window before that
 * callback ran. If native code handed the same GObject back to JS in that window
 * — e.g. a signal argument, or fetching it from a container — WrapperFromGObject
 * reused the zapped persistent and returned it to JS. Touching it then crashed
 * reading the object's map word (rax == 0x1baffed00baffedf, V8's
 * kGlobalHandleZapValue), as seen in the wild during a nested main loop.
 *
 * The fix detaches the qdata in a *first-pass* weak callback, which runs during
 * GC before any JS/GTK code resumes, so WrapperFromGObject builds a fresh
 * wrapper instead of resurrecting the dead one.
 *
 * Like the ToggleNotify race test, hitting the exact zap window deterministically
 * depends on GC scheduling, so this exercises the collect-then-refetch path
 * (creating a GObject, keeping it alive natively in a Gio.ListStore, dropping the
 * JS reference, forcing GC, then fetching it back and touching it) rather than
 * guaranteeing a crash on the unfixed code.
 */

const assert = require('assert')
const gi = require('../lib/')
const { describe } = require('./__common__.js')

if (typeof global.gc !== 'function') {
  console.error('test must run with --expose-gc')
  process.exit(1)
}

const Gio = gi.require('Gio', '2.0')
const GObject = gi.require('GObject', '2.0')

describe('refetching a GC-collected wrapper from native does not crash', () => {
  const store = Gio.ListStore.new(GObject.TYPE_OBJECT)

  // Several objects, each kept alive only by the store's native ref. Their JS
  // wrappers go out of scope immediately.
  for (let i = 0; i < 16; i++) {
    ;(() => {
      store.append(new Gio.MemoryInputStream())
    })()
  }

  // Force GC: V8 reclaims the wrappers and zaps their Persistent handles.
  global.gc()
  global.gc()

  // Marshal each GObject back to JS. WrapperFromGObject runs for every item —
  // it must never hand back a dead handle. Touch each result to read its V8 map.
  for (let i = 0; i < 16; i++) {
    const item = store.getItem(i)
    assert.ok(item instanceof Gio.MemoryInputStream)
    void item.constructor
    // Refetching must be identity-stable now that a live wrapper exists.
    assert.strictEqual(store.getItem(i), item)
  }

  global.gc()
  global.gc()
})
