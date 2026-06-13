/*
 * marshalling__struct.js
 *
 * Exercises struct and union marshalling using the gobject-introspection
 * GIMarshallingTests library: simple/pointer/boxed structs and a union, their
 * field getters (camelCased, so long_ -> long, string_ -> string, g_strv ->
 * gStrv), instance methods, construction, and array-in.
 *
 * KNOWN ISSUE (skip()'d below): an array of structs passed by *value* IN is
 * mismarshalled (#404). The array-of-pointers forms work and are tested above.
 */

const { describe, expect, assert, skip } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

describe('simple struct returnv (fields + inv method)', () => {
  const s = m.simpleStructReturnv()
  expect(s.long, 6)
  expect(s.int8, 7)
  s.inv() // g_asserts long == 6 && int8 == 7
})

describe('simple struct construction', () => {
  const s = new m.SimpleStruct({ long: 6, int8: 7 })
  expect(s.long, 6)
  expect(s.int8, 7)
  s.inv()
})

describe('pointer struct returnv (long == 42)', () => {
  const s = m.pointerStructReturnv()
  expect(s.long, 42)
  s.inv()
})

describe('boxed struct returnv (long/string/gStrv)', () => {
  const s = m.boxedStructReturnv()
  expect(s.long, 42)
  expect(s.string, 'hello')
  expect(s.gStrv, ['0', '1', '2'])
  s.inv()
})

describe('boxed struct out (long == 42)', () => {
  expect(m.boxedStructOut().long, 42)
})

describe('boxed struct inout (long 42 -> 0)', () => {
  expect(m.boxedStructInout(m.boxedStructReturnv()).long, 0)
})

describe('boxed struct out uninitialized (returns false)', () => {
  const [ok] = m.boxedStructOutUninitialized()
  assert(ok === false, `boxedStructOutUninitialized return should be false, got ${ok}`)
})

describe('union returnv (long == 42)', () => {
  expect(m.unionReturnv().long, 42)
})

describe('array of struct pointers in (none/take)', () => {
  const mk = (n) => { const s = new m.BoxedStruct(); s.long = n; return s }
  m.arrayStructIn([mk(1), mk(2), mk(3)])     // GIMarshallingTestsBoxedStruct **
  m.arrayStructTakeIn([mk(1), mk(2), mk(3)]) // transfer full
})

// Everything below crashes — see the file header.
skip()

// #404 — array of structs by value IN is mismarshalled (garbage contents).
describe('array of structs by value in (#404)', () => {
  const mkS = (n) => { const s = new m.SimpleStruct(); s.long = n; return s }
  const mkB = (n) => { const s = new m.BoxedStruct(); s.long = n; return s }
  m.arraySimpleStructIn([mkS(1), mkS(2), mkS(3)])
  m.arrayStructValueIn([mkB(1), mkB(2), mkB(3)])
})
