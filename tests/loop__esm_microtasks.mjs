/*
 * loop__esm_microtasks.mjs
 *
 * Promise/async microtasks must keep draining while GLib.MainLoop.run() blocks,
 * even under ES modules (where the top-level body runs as a V8 microtask).
 * https://github.com/romgrk/node-gtk/issues/442
 *
 * Run as a child process by loop__esm_microtasks.js (the .mjs is not picked up
 * by the test runner, which only collects .js files). Exits 0 on success.
 */

import { createRequire } from 'node:module'

const gi = createRequire(import.meta.url)('..')
const GLib = gi.require('GLib', '2.0')

const loop = GLib.MainLoop.new(null, false)

let microtaskDrained = false
Promise.resolve().then(() => { microtaskDrained = true })

let asyncDrained = false
;(async () => { await Promise.resolve(); asyncDrained = true })()

let result = null
GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 100, () => {
  /* 100ms into the loop the microtasks scheduled before run() must have drained */
  result = { microtaskDrained, asyncDrained }
  loop.quit()
  return false
})


/* Under ESM this returns immediately (the blocking call is deferred to a
 * macrotask so the module's top-level microtask can return); the loop still
 * runs to completion afterwards. */
loop.run()

process.on('exit', () => {
  if (!result || !result.microtaskDrained || !result.asyncDrained) {
    console.error('FAIL: microtasks did not drain during the loop under ESM:', result)
    process.exitCode = 1
    return
  }
  console.log('OK: microtasks drained during the loop under ESM')
})
