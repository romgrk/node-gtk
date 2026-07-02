/*
 * loop__esm_idle_cpu.js
 *
 * Regression test for #477: a running GApplication busy-spun at 100% CPU under
 * ES modules (worst on Node 26 / libuv 1.52) because the deferred blocking
 * run() ran inside Node's immediate machinery and leaked its idle handle.
 * Spawns the ESM repro as a child process and asserts it stays at low CPU.
 */

const path = require('path')
const child_process = require('child_process')
const { assert } = require('./__common__')

const child = path.join(__dirname, 'loop__esm_idle_cpu.mjs')

/* When the bug is present the busy-spin also starves the child's own GLib
 * timeout, so it never quits on its own -- a hard timeout is what surfaces the
 * failure (SIGKILL because a spinning native loop ignores SIGTERM). A healthy
 * run measures for ~1.5s and exits well within this window. */
const result = child_process.spawnSync(process.execPath, [child], {
  encoding: 'utf8',
  timeout: 30 * 1000,
  killSignal: 'SIGKILL',
})

process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')

if (result.signal)
  assert(false, `an idle GApplication busy-spun under ESM (child killed by ${result.signal})`)

assert(
  result.status === 0,
  `an idle GApplication should not busy-spin under ESM (child exited ${result.status})`
)
