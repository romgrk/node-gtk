/*
 * loop.js
 */

const internal = require('./native.js')

module.exports = {
  start,
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
