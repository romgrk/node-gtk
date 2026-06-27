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
 * Under CommonJS (and inside signal callbacks) we are not in a microtask, so we
 * run synchronously and preserve the original blocking semantics exactly.
 *
 * https://github.com/romgrk/node-gtk/issues/442
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
    setImmediate(run)
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
