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
let Promise = global.Promise

class WrappedPromise extends Promise {
  constructor(fn) {
    console.log('wrapped')
    process._tickCallback()
    super(fn)
  }
}

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
  global.Promise = WrappedPromise

  internal.StartLoop()
}


// Helpers

function wrappedLoopFunction(fn) {
  return (...args) => {
    process._tickCallback()
    return fn(...args)
  }
}


