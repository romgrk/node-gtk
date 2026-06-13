/*
 * loop.js
 */

const internal = require('./native.js')

module.exports = {
  start,
}


let loopStarted = false
let originalNextTick = process.nextTick
let originalSetTimeout = global.setTimeout
let originalSetInterval = global.setInterval
let originalSetImmediate = global.setImmediate

/**
 * Starts the loops integration
 */
function start() {
  if (loopStarted)
    return
  loopStarted = true

  process.nextTick = wrappedLoopFunction(originalNextTick)
  global.setTimeout = wrappedLoopFunction(originalSetTimeout)
  global.setInterval = wrappedLoopFunction(originalSetInterval)
  global.setImmediate = wrappedLoopFunction(originalSetImmediate)

  internal.StartLoop()
}


// Helpers

function wrappedLoopFunction(timerFunction) {
  return (callback, ...rest) => {
    return timerFunction(tryCallback(callback), ...rest)
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
