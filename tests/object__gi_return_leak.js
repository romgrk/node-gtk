/*
 * object__gi_return_leak.js
 *
 * Regression test for #446: GObjects returned from GI functions leaked.
 *
 * A transfer-full GObject return (constructor helpers like `Type.new()`, and
 * transfer-full returns generally) hands node-gtk an owning reference on top of
 * the wrapper's toggle ref. node-gtk only needs the toggle ref, so that extra
 * reference must be released; otherwise the refcount never falls back to 1,
 * ToggleNotify never flips the V8 handle to weak, and the object (and its
 * wrapper) is pinned alive forever. The same type built with `new Type()` — which
 * drops its construction ref in GObjectConstructor — was collected correctly, so
 * the leak was specific to the GI-return path.
 *
 * Here we create many GMenu via Gio.Menu.new(), drop every reference, and force
 * GC. With the bug essentially none are reclaimed (a 1:1 leak); with the fix the
 * wrappers go weak and are collected.
 */

const assert = require('assert')
const gi = require('../lib/')
const { describe } = require('./__common__.js')

if (typeof global.gc !== 'function') {
  console.error('test must run with --expose-gc')
  process.exit(1)
}

const Gio = gi.require('Gio', '2.0')

describe('GObjects returned from GI functions are GC-collectable', async () => {
  const N = 2000
  let collected = 0
  const registry = new FinalizationRegistry(() => { collected++ })

  ;(() => {
    for (let i = 0; i < N; i++) {
      // Gio.Menu.new() is a GI function return (transfer-full).
      const m = Gio.Menu.new()
      registry.register(m)
      m.freeze() // touch it, then drop every reference
    }
  })()

  for (let g = 0; g < 12 && collected < N; g++) {
    global.gc()
    await new Promise(r => setImmediate(r))
  }

  // With the leak ~0 are collected; with the fix nearly all are. The slack
  // tolerates the handful that may still be pinned by a handle scope / the V8
  // stack at GC time.
  assert(
    collected >= N * 0.8,
    `expected GMenu wrappers from Gio.Menu.new() to be collected, got ${collected}/${N}`)
})
