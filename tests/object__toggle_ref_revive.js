/*
 * object__toggle_ref_revive.js
 *
 * Regression test for wrappers being garbage-collected while their GObject is
 * still alive and owned natively.
 *
 * A freshly constructed object sits at refcount 1 (only node-gtk's toggle ref),
 * so its wrapper is made weak (collectable). When something else then takes a
 * reference — e.g. inserting a widget into a container — ToggleNotify fires with
 * toggle_down=false and must call ClearWeak to make the wrapper strong again.
 *
 * The #438 fix added an `if (dying) return` guard *before* the toggle-up branch,
 * so ClearWeak was never reached: a wrapper that had gone weak once stayed weak
 * even after the object gained an owner. GC then collected the wrapper while the
 * GObject was still in use. For a plain object this loses any JS expandos and
 * identity; for a JS-subclassed GObject it loses the overridden vfuncs and
 * instance state (e.g. a GtkSource.GutterRendererText subclass crashed/raised
 * `this.setMarkup is not a function` once its wrapper was rebuilt).
 *
 * The fix revives the wrapper (ClearWeak + clear dying) on toggle-up. This test
 * checks deterministically that an expando set before native ownership survives
 * GC — i.e. the wrapper was not collected.
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

describe('wrapper survives GC while its object is owned natively', () => {
  const store = Gio.ListStore.new(GObject.TYPE_OBJECT)

  ;(() => {
    // Constructed object is at refcount 1 → its wrapper is weak.
    const o = new Gio.MemoryInputStream()
    // Expando lives on the JS wrapper; it is lost if the wrapper is rebuilt.
    o.__regressionTag = 0xC0FFEE
    // The store takes a ref (refcount 1→2) → toggle-up must revive the wrapper.
    store.append(o)
    // `o` leaves scope; only the (now-strong) wrapper keeps the JS object.
  })()

  global.gc()
  global.gc()

  // If the wrapper had been collected, getItem would build a fresh one without
  // the expando.
  const back = store.getItem(0)
  assert.strictEqual(back.__regressionTag, 0xC0FFEE)
})
