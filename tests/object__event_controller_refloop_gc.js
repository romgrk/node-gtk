/*
 * object__event_controller_refloop_gc.js
 *
 * Regression test for the signal-handler reference-loop leak (#375) as it
 * manifests through Gtk event controllers — a pattern that bit real code.
 *
 * Connecting a handler to a Gtk.EventController that closes over the controller
 * (or the widget it belongs to) forms the same uncollectable C++/JS cycle as a
 * plain self-referential signal handler, just one hop deeper: the Closure's
 * strong reference pins the handler -> the wrapper it closes over -> the
 * controller/widget -> the Closure. Before the fix the closed-over object was
 * never collected; afterwards the whole cycle is reclaimed.
 *
 * Master, per scenario (FinalizationRegistry over 40 GC passes):
 *   - handler closes over controller -> controller collected 0/N
 *   - handler closes over widget     -> widget collected     0/N
 * With the fix both collect fully.
 */

const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const { describe, assert } = require('./__common__.js')

Gtk.init()

if (typeof global.gc !== 'function') {
  console.error('test must run with --expose-gc')
  process.exit(1)
}

const N = 50

// Built inside a nested function so no locals stay on the caller's stack frame,
// which would otherwise pin them across GC. `closeOver` selects which object the
// handler captures — and therefore which one used to leak; that same object is
// the one registered for finalization.
function makeBatch(reg, closeOver) {
  for (let i = 0; i < N; i++) {
    const widget = new Gtk.Button()
    const controller = Gtk.EventControllerKey.new(widget)
    if (closeOver === 'controller') {
      reg.register(controller, i)
      controller.on('key-pressed', () => controller)
    } else {
      reg.register(widget, i)
      controller.on('key-pressed', () => widget.get_label())
    }
  }
}

async function collectedCount(closeOver) {
  let finalized = 0
  const reg = new FinalizationRegistry(() => { finalized++ })
  makeBatch(reg, closeOver)
  for (let k = 0; k < 40 && finalized < N; k++) {
    global.gc()
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return finalized
}

describe('event-controller signal handlers do not leak their object (#375)', async () => {
  const overController = await collectedCount('controller')
  assert(overController >= N * 0.9,
    `controllers with a self-referential handler leaked: only ${overController}/${N} collected`)

  const overWidget = await collectedCount('widget')
  assert(overWidget >= N * 0.9,
    `widgets behind a controller handler leaked: only ${overWidget}/${N} collected`)
})
