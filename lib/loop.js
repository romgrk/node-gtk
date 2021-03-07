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
  return (...args) => {
    process._tickCallback()
    return fn(...args)
  }
}


