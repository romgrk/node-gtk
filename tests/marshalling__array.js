/*
 * marshalling__array.js
 *
 * Exercises C-array marshalling (fixed-size, length-prefixed, zero-terminated)
 * in every direction using the gobject-introspection GIMarshallingTests library.
 *
 * As with the integer tests, `*In` functions g_assert their argument against a
 * canonical value, so we pass exactly the values the library expects:
 * the int arrays are [-1, 0, 1, 2].
 */

const { describe, it, expect } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

const CANONICAL = [-1, 0, 1, 2]

describe('fixed-size int array: return', () => {
  expect(m.arrayFixedIntReturn(), CANONICAL)
})

describe('fixed-size int array: in', () => {
  m.arrayFixedIntIn(CANONICAL)
})

describe('fixed-size int array: out', () => {
  expect(m.arrayFixedOut(), CANONICAL)
})

describe('fixed-size int array: inout', () => {
  // inout reverses then maps; verified against the library's behaviour.
  expect(m.arrayFixedInout(CANONICAL), [2, 1, 0, -1])
})

describe('length-prefixed int array: return', () => {
  expect(m.arrayReturn(), CANONICAL)
})

describe('length-prefixed int array: in', () => {
  m.arrayIn(CANONICAL)
})

describe('length-prefixed int array: out', () => {
  expect(m.arrayOut(), CANONICAL)
})

describe('length-prefixed int array: inout (prepends -2)', () => {
  expect(m.arrayInout(CANONICAL), [-2, -1, 0, 1, 2])
})

describe('bool array: out', () => {
  expect(m.arrayBoolOut(), [true, false, true, true])
})
