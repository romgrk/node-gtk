/*
 * loop__esm_idle_cpu.mjs
 *
 * A running GApplication must sit idle at low CPU, not busy-spin. Under ES
 * modules the blocking run() is deferred to a macrotask; deferring it with
 * setImmediate (as node-gtk used to) ran the never-returning blocking call
 * inside Node's immediate machinery, which left Node's private immediate
 * uv_idle handle active forever and busy-spun the nested uv-in-GLib loop at
 * 100% CPU (worst on Node 26 / libuv 1.52). See #477.
 *
 * Run as a child process by loop__esm_idle_cpu.js. Uses Gio.Application (no
 * display required, so it works headless in CI). Exits 0 on success.
 */

import { createRequire } from 'node:module'

const gi = createRequire(import.meta.url)('..')
const Gio = gi.require('Gio', '2.0')
const GLib = gi.require('GLib', '2.0')

const loop = GLib.MainLoop.new(null, false)
const app = new Gio.Application('org.nodegtk.test.IdleCpu', 0)

let cpuPercent = null

app.on('activate', () => {
  /* Keep the application alive with no window; this alone reproduced the spin. */
  app.hold()

  const cpuStart = process.cpuUsage()
  const wallStart = Date.now()

  /* Sample CPU after the loop has been idle for a while. */
  GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 1500, () => {
    const cpu = process.cpuUsage(cpuStart)
    const wallMs = Date.now() - wallStart
    cpuPercent = ((cpu.user + cpu.system) / 1000) / wallMs * 100
    app.release()
    loop.quit()
    return GLib.SOURCE_REMOVE
  })

  loop.run()
})

/* Under ESM this returns immediately (the blocking call is deferred). */
app.run()

process.on('exit', () => {
  /* The bug pins a core at ~100%; a correctly-sleeping loop stays near 0%.
   * 50% is a wide margin that stays clear of both under CI load. */
  if (cpuPercent === null || cpuPercent > 50) {
    console.error(`FAIL: idle GApplication used ${cpuPercent && cpuPercent.toFixed(0)}% CPU (expected < 50%)`)
    process.exitCode = 1
    return
  }
  console.log(`OK: idle GApplication used ${cpuPercent.toFixed(0)}% CPU under ESM`)
})
