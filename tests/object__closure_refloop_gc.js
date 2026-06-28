/*
 * object__closure_refloop_gc.js
 *
 * Regression test for the signal-handler reference-loop leak (#375).
 *
 * A signal handler that closes over the object it is connected to used to form
 * an uncollectable cycle: the Closure held the handler in a strong
 * Nan::Persistent, which rooted the handler -> the JS wrapper it closes over ->
 * the GObject (kept alive by node-gtk's toggle ref) -> the Closure. The cycle
 * straddled C++ and JS so V8 could never collect it, and the wrapper (plus its
 * GObject) leaked for the lifetime of the process.
 *
 * The fix stores the handler in a v8::TracedReference traced by a cppgc object
 * that lives exactly as long as the wrapper is reachable, so once the wrapper
 * is unreachable the handler is collected too and the cycle breaks.
 *
 * We measure wrapper liveness with a FinalizationRegistry:
 *   - control (no handler): wrappers must be collected (proves the harness/GC
 *     actually reclaims these objects).
 *   - leaky (self-referential handler): wrappers must also be collected — they
 *     stayed pinned at 0% before the fix.
 */

const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const { describe, assert } = require('./__common__.js')

Gtk.init()

if (typeof global.gc !== 'function') {
  console.error('test must run with --expose-gc')
  process.exit(1)
}

const N = 100

// Build the object graph inside a nested function so no locals stay on the
// caller's stack frame, which would otherwise pin them across GC.
function makeBatch(withHandler, reg) {
  for (let i = 0; i < N; i++) {
    const obj = new Gtk.Button()
    reg.register(obj, i)
    if (withHandler)
      obj.on('clicked', () => obj.get_label()) // handler closes over `obj`
  }
}

async function collectedCount(withHandler) {
  let finalized = 0
  const reg = new FinalizationRegistry(() => { finalized++ })
  makeBatch(withHandler, reg)
  // FinalizationRegistry callbacks run on a later turn of the loop, and a few
  // GC passes are needed to flush young/old generations and the two-pass weak
  // callbacks node-gtk uses.
  for (let k = 0; k < 30 && finalized < N; k++) {
    global.gc()
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return finalized
}

describe('signal handlers do not leak their object (#375)', async () => {
  const control = await collectedCount(false)
  assert(control >= N * 0.9,
    `control objects were not collected (${control}/${N}); GC/harness issue`)

  const leaky = await collectedCount(true)
  assert(leaky >= N * 0.9,
    `self-referential-handler objects leaked: only ${leaky}/${N} collected`)
})
