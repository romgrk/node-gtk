/*
 * marshalling__float.js
 *
 * Exercises gfloat / gdouble marshalling in every direction using the
 * gobject-introspection GIMarshallingTests library.
 */

const { describe, it, expect, assert } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

const FLT_MAX = 3.4028234663852886e+38
const FLT_MIN = 1.1754943508222875e-38  // smallest positive normal float
const DBL_MAX = Number.MAX_VALUE         // 1.7976931348623157e+308
const DBL_MIN = 2.2250738585072014e-308  // smallest positive normal double

describe('float return/out', () => {
  expect(m.floatReturn(), FLT_MAX)
  expect(m.floatOut(), FLT_MAX)
})

describe('float in', () => {
  m.floatIn(m.floatReturn())
})

describe('float inout (max -> min)', () => {
  expect(m.floatInout(m.floatReturn()), FLT_MIN)
})

describe('double return/out', () => {
  expect(m.doubleReturn(), DBL_MAX)
  expect(m.doubleOut(), DBL_MAX)
})

describe('double in', () => {
  m.doubleIn(m.doubleReturn())
})

describe('double inout (max -> min)', () => {
  expect(m.doubleInout(m.doubleReturn()), DBL_MIN)
})

describe('noncanonical NaN out', () => {
  assert(Number.isNaN(m.floatNoncanonicalNanOut()), 'float NaN out should be NaN')
  assert(Number.isNaN(m.doubleNoncanonicalNanOut()), 'double NaN out should be NaN')
})
