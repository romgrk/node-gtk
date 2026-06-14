/*
 * loop__esm_microtasks.js
 *
 * Regression test for #442: under ES modules, Promise/async continuations were
 * starved for the entire lifetime of GLib.MainLoop.run() (they worked under
 * CommonJS). Spawns the ESM repro as a child process and asserts it succeeds.
 */

const path = require('path')
const child_process = require('child_process')
const { assert } = require('./__common__')

const child = path.join(__dirname, 'loop__esm_microtasks.mjs')
const result = child_process.spawnSync(process.execPath, [child], { encoding: 'utf8' })

process.stdout.write(result.stdout)
process.stderr.write(result.stderr)

assert(
  result.status === 0,
  `ESM microtasks should drain while the main loop runs (child exited ${result.status})`
)
