/*
 * loop.js
 */

const internal = require('./native.js')

module.exports = {
  start,
  runLoopEntry,
}


let didStart = false
let nextTick = process.nextTick
let setTimeout = global.setTimeout
let setInterval = global.setInterval
let setImmediate = global.setImmediate

/**
 * Starts the loops integration
 */
function start() {
  if (didStart)
    return
  didStart = true

  process.nextTick = wrappedLoopFunction(nextTick)
  global.setTimeout = wrappedLoopFunction(setTimeout)
  global.setInterval = wrappedLoopFunction(setInterval)
  global.setImmediate = wrappedLoopFunction(setImmediate)

  internal.StartLoop()
}


/**
 * Runs a blocking main-loop entry point (e.g. GLib.MainLoop.run,
 * Gio.Application.run, Gtk.main) so that Promise/async continuations keep
 * draining while it blocks.
 *
 * Under ES modules the top-level body executes as a V8 microtask, so a blocking
 * call made directly from it nests inside V8's microtask drain. V8 refuses
 * nested microtask checkpoints, so any pending Promise/async continuation is
 * starved for the entire lifetime of the loop. Deferring the blocking call to a
 * macrotask lets the module's top-level microtask return first, so the queue
 * drains and the loop integration takes over from a clean (non-nested) state.
 *
 * We defer with setTimeout, NOT setImmediate. A setImmediate callback runs
 * *inside* Node's immediate-processing machinery (native CheckImmediate ->
 * processImmediate). Because `run` never returns (it blocks in the GLib main
 * loop until the app quits), CheckImmediate never reaches the code that stops
 * Node's private immediate uv_idle handle, so that handle stays active forever.
 * An active idle handle pins uv_backend_timeout() at 0, which makes the nested
 * uv-in-GLib loop busy-spin at 100% CPU (worse on Node 26 / libuv 1.52, where
 * the immediate's wakeup eventfd also stays signalled). A one-shot timer is
 * removed from libuv's timer heap before its callback runs, so blocking inside
 * it leaves no libuv state active and the loop can sleep normally. See #477.
 *
 * Under CommonJS (and inside signal callbacks) we are not in a microtask, so we
 * run synchronously and preserve the original blocking semantics exactly.
 *
 * https://github.com/romgrk/node-gtk/issues/442
 * https://github.com/romgrk/node-gtk/issues/477
 *
 * Returns the native call's result when run synchronously (so e.g.
 * `const status = app.run()` keeps working under CommonJS); returns undefined
 * when deferred, since the result is not yet available.
 *
 * @param {Function} run - performs the blocking native call
 * @returns {*} the native return value, or undefined when deferred
 */
function runLoopEntry(run) {
  // The loop integration must be active before we block in a native main loop,
  // so start it automatically on the first run. Calling startLoop() explicitly
  // still works and is no longer required (start() is idempotent).
  start()

  if (internal.IsRunningMicrotasks()) {
    setTimeout(run, 0)
    return undefined
  }
  return run()
}


// Helpers

function wrappedLoopFunction(fn) {
  return (callback, ...rest) => {
    return fn(tryCallback(callback), ...rest)
  }
}

function tryCallback(fn) {
  return (...args) => {
    try {
      return fn(...args)
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  }
}
