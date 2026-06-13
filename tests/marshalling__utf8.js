/*
 * marshalling__utf8.js
 *
 * Exercises utf8 string marshalling in every direction and across transfer
 * modes (none/full) using the gobject-introspection GIMarshallingTests library.
 */

const { describe, it, expect } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

// GI_MARSHALLING_TESTS_CONSTANT_UTF8
const CONST_UTF8 = 'const ♥ utf8'

describe('utf8 return (transfer none/full)', () => {
  expect(m.utf8NoneReturn(), CONST_UTF8)
  expect(m.utf8FullReturn(), CONST_UTF8)
})

describe('utf8 out (transfer none/full)', () => {
  expect(m.utf8NoneOut(), CONST_UTF8)
  expect(m.utf8FullOut(), CONST_UTF8)
})

describe('utf8 in (transfer none/full)', () => {
  m.utf8NoneIn(CONST_UTF8)
  m.utf8FullIn(CONST_UTF8)
})

describe('utf8 inout (-> empty string)', () => {
  expect(m.utf8NoneInout(CONST_UTF8), '')
  expect(m.utf8FullInout(CONST_UTF8), '')
})
