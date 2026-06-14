/*
 * object__toggle_ref_race.js
 *
 * Regression test for the ToggleNotify race condition: when a GObject wrapper
 * goes out of JS scope, V8 GC zaps the Persistent handle and schedules
 * GObjectDestroyed. In the window between the zap and the callback, native code
 * can call g_object_unref and hit the toggle point (refcount 2→1), which fires
 * ToggleNotify. Before the fix, ToggleNotify would call SetWeak on the already-
 * zapped handle and crash with "Check failed: object_ != kGlobalHandleZapValue".
 *
 * Reproduced by: creating a GObject, adding it to a Gio.ListStore (which takes
 * a native ref, refcount=2), dropping the JS reference, forcing GC (zapping the
 * handle), then removing it from the store (refcount 2→1, ToggleNotify fires).
 */

const gi = require('../lib/')
const { describe } = require('./__common__.js')

if (typeof global.gc !== 'function') {
  console.error('test must run with --expose-gc')
  process.exit(1)
}

const Gio = gi.require('Gio', '2.0')
const GObject = gi.require('GObject', '2.0')

describe('ToggleNotify with zapped persistent does not crash', () => {
  const store = Gio.ListStore.new(GObject.TYPE_OBJECT)

  // Create a GObject and add it to the store. The store takes a native ref so
  // refcount = 2 (toggle ref + store). The JS variable then goes out of scope.
  ;(() => {
    const stream = new Gio.MemoryInputStream()
    store.append(stream)
  })()

  // Force GC: V8 zaps the Persistent handle and schedules GObjectDestroyed.
  global.gc()
  global.gc()

  // Remove from store: store calls g_object_unref (refcount 2→1).
  // ToggleNotify fires — without the fix this crashes.
  store.remove(0)

  global.gc()
  global.gc()
})
