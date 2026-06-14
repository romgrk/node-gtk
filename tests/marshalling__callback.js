/*
 * marshalling__callback.js
 *
 * Exercises callback (scope call) and GClosure marshalling using the
 * gobject-introspection GIMarshallingTests library.
 *
 * node-gtk's out-parameter convention for callbacks: a callback with out
 * params returns them as an array (even a single out param -> [value]); when
 * the callback also has a return value it comes first ([retval, ...outs]). The
 * caller-side function returns a single unwrapped value when there is exactly
 * one result, or an array when there are several.
 *
 * The glong return value / out params come back as BigInt (#323, #149); the
 * JS callback may still produce a plain Number for them.
 */

const { describe, expect } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

describe('callback return value only', () => {
  expect(m.callbackReturnValueOnly(() => 42), 42n)
})

describe('callback one out parameter', () => {
  expect(m.callbackOneOutParameter(() => [43.5]), 43.5)
})

describe('callback multiple out parameters', () => {
  expect(m.callbackMultipleOutParameters(() => [44, 45]), [44, 45])
})

describe('callback return value and one out parameter', () => {
  expect(m.callbackReturnValueAndOneOutParameter(() => [46, 47]), [46n, 47n])
})

describe('callback return value and multiple out parameters', () => {
  expect(m.callbackReturnValueAndMultipleOutParameters(() => [48, 49, 50]), [48n, 49n, 50n])
})

describe('gclosure return (-> GClosure)', () => {
  const closure = m.gclosureReturn()
  expect(closure.constructor.name, 'GClosure')
})

describe('gclosure in (closure returning int 42)', () => {
  // gclosureReturn() yields exactly the int-42 closure gclosureIn expects;
  // round-trip it (node-gtk does not auto-wrap a plain JS function as GClosure).
  m.gclosureIn(m.gclosureReturn())
})
