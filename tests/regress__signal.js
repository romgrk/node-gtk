/*
 * regress__signal.js
 *
 * Exercises GObject signal emission and handler marshalling using the
 * gobject-introspection Regress library.
 *
 * node-gtk passes only the signal's own parameters to a handler (it does NOT
 * prepend the emitting instance), so a VOID__VOID signal handler takes no args.
 */

const { describe, expect, assert } = require('./__common__.js')
const { requireRegress } = require('./__gi-fixtures__.js')

const R = requireRegress()

describe('connect + emit a void signal ("all")', () => {
  const o = new R.TestObj()
  let count = 0
  o.connect('all', () => { count++ })
  o.emit('all')
  expect(count, 1)
})

describe('signal with object argument ("sig-with-obj")', () => {
  const o = new R.TestObj()
  let seenInt = null
  // The handler receives only the signal parameter (the emitted GObject, int=3).
  o.connect('sig-with-obj', (param) => { seenInt = param.int })
  o.emitSigWithObj()
  expect(seenInt, 3)
})

describe('signal with int64 return value ("sig-with-int64-prop")', () => {
  // The library emits with G_MAXINT64 and asserts the handler returned it.
  const o = new R.TestObj()
  let received
  o.connect('sig-with-int64-prop', (v) => { received = v; return v })
  o.emitSigWithInt64() // g_asserts the returned value == G_MAXINT64
  assert(received !== undefined, 'handler should receive the int64 argument')
})

// The inout gint* is dereferenced for the handler (which sees 42), and the
// handler's return value is written back into it (the library asserts 43).
describe('signal with inout int ("sig-with-inout-int")', () => {
  const o = new R.TestObj()
  let received
  o.connect('sig-with-inout-int', (v) => { received = v; return v + 1 })
  o.emitSigWithInoutInt() // g_asserts the inout param became 43
  expect(received, 42)
})
