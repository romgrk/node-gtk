/*
 * marshalling__boolean.js
 *
 * Exercises gboolean marshalling in every direction (in/out/inout/return) using
 * the gobject-introspection GIMarshallingTests library.
 */

const { describe, it, expect } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

describe('boolean return', () => {
  expect(m.booleanReturnTrue(), true)
  expect(m.booleanReturnFalse(), false)
})

describe('boolean in', () => {
  // These g_assert internally that they received the expected value; reaching
  // the next line without aborting means the value marshalled correctly.
  m.booleanInTrue(true)
  m.booleanInFalse(false)
})

describe('boolean out', () => {
  expect(m.booleanOutTrue(), true)
  expect(m.booleanOutFalse(), false)
})

describe('boolean inout', () => {
  expect(m.booleanInoutTrueFalse(true), false)
  expect(m.booleanInoutFalseTrue(false), true)
})
