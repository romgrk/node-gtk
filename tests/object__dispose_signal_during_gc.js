/*
 * object__dispose_signal_during_gc.js
 *
 * Regression test for a use-after-free crash where dropping a GObject's toggle
 * ref re-entered JS *during* garbage collection.
 *
 * When V8 GC reclaims a wrapper, the second-pass weak callback used to call
 * g_object_remove_toggle_ref inline. Removing the last ref disposes the GObject,
 * and GTK's dispose synchronously emits signals (e.g. ::destroy) into the
 * node-gtk closures still connected to it — i.e. it calls back into JS. Doing
 * that from inside V8's InvokeSecondPassPhantomCallbacks crashed in
 * v8::Object::CallAsFunction (observed in the wild: rax == 0, faulting under
 * g_signal_emit -> GNodeJS::Closure::Execute -> Nan::Call, while GC was running).
 *
 * The fix defers the teardown to a GLib main-loop idle, so the ref drop and any
 * disposal/signal emission it triggers happen at a point where calling into JS
 * is legal again.
 *
 * Reproducing disposal-emits-a-signal deterministically needs a display-backed
 * widget, so (like the other toggle-ref GC tests) this exercises the path rather
 * than guaranteeing a crash on the unfixed code: it connects signal handlers to
 * objects, drops every JS/native reference, forces GC (scheduling the deferred
 * teardown), then iterates the main loop so the teardown runs. It must not crash,
 * and signal handlers connected to live objects must keep working across the GC.
 */

const assert = require('assert')
const gi = require('../lib/')
const { describe } = require('./__common__.js')

if (typeof global.gc !== 'function') {
  console.error('test must run with --expose-gc')
  process.exit(1)
}

const GLib = gi.require('GLib', '2.0')
const Gio = gi.require('Gio', '2.0')


// Run the GLib main loop briefly so any deferred teardown idles get to fire,
// then return control to JS.
function pumpMainLoop() {
  const loop = GLib.MainLoop.new(null, false)
  GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 30, () => {
    loop.quit()
    return GLib.SOURCE_REMOVE
  })
  loop.run()
}

describe('collecting objects with connected handlers, then pumping the loop, does not crash', () => {
  for (let i = 0; i < 32; i++) {
    ;(() => {
      const action = Gio.SimpleAction.new(`act-${i}`, null)
      // Connect a closure so the object owns a node-gtk Closure across its
      // lifetime — the thing whose invocation during GC caused the crash.
      action.on('notify', () => {})
      action.on('activate', () => {})
      // No reference is retained: the wrapper becomes collectable immediately.
    })()
  }

  // GC reclaims the wrappers; the second-pass callback now schedules a deferred
  // teardown idle instead of dropping the toggle ref inline during GC.
  global.gc()
  global.gc()

  // The deferred teardown (and any disposal/signal emission it triggers) runs
  // here, on the main loop — outside GC. Before the fix the equivalent work ran
  // mid-GC and could re-enter JS and crash.
  pumpMainLoop()

  global.gc()
  global.gc()
  pumpMainLoop()
})

describe('a handler on a live object still fires after a GC cycle', () => {
  const action = Gio.SimpleAction.new('persistent', null)
  let fired = 0
  action.on('notify', () => { fired++ })

  // Churn unrelated collectable objects + GC + loop, so deferred teardowns run
  // while `action` stays alive and its closure must remain valid.
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < 16; i++)
      Gio.SimpleAction.new(`tmp-${round}-${i}`, null).on('activate', () => {})
    global.gc()
    pumpMainLoop()
  }

  // The notify::enabled signal fires when the property actually changes.
  action.setEnabled(false)

  assert.ok(fired > 0, 'notify handler on a live object should still fire after GC + teardown')
})
