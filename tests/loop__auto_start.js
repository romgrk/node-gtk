/*
 * loop__auto_start.js
 *
 * The GLib<->Node loop integration starts automatically the first time a main
 * loop runs, so startLoop() is no longer required. Proof: a JS setTimeout fires
 * while GLib.MainLoop.run() blocks, which only happens when the integration is
 * active — and startLoop() is never called here.
 */

const { describe, it, expect } = require('./__common__')

const gi = require('..')
const GLib = gi.require('GLib', '2.0')

describe('loop auto-start', () => {
  it('integrates the Node loop without an explicit startLoop()', () => {
    let jsTimerFired = false
    setTimeout(() => { jsTimerFired = true }, 50)

    const loop = GLib.MainLoop.new(null, false)
    GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 200, () => {
      loop.quit()
      return false
    })

    loop.run() // blocks ~200ms; note: no startLoop() call

    // The JS timer (50ms) fired during the GLib loop -> integration auto-started.
    expect(jsTimerFired, true)
  })
})
