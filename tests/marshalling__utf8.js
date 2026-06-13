/*
 * marshalling__utf8.js
 *
 * Exercises utf8 string marshalling in every direction and across transfer
 * modes (none/full), including the transfer-full IN and INOUT cases.
 *
 * (The IN-with-ownership cases — utf8FullIn, utf8NoneInout, utf8FullInout —
 * previously appeared to crash only on the Ubuntu CI runners. That was an
 * artifact of the runners building GIMarshallingTests from a different, older
 * gobject-introspection source than the dev machines; the suite now builds the
 * fixtures from a single pinned upstream source on every platform, so they are
 * exercised everywhere.)
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
