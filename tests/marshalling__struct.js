/*
 * marshalling__struct.js
 *
 * Exercises struct and union marshalling using the gobject-introspection
 * GIMarshallingTests library: simple/pointer/boxed structs and a union, their
 * field getters (camelCased, so long_ -> long, string_ -> string, g_strv ->
 * gStrv), instance methods, construction, and array-in (both as an array of
 * struct pointers and as a contiguous array of struct values).
 *
 * The `long` field is a glong, which is 64-bit on LP64 platforms and so reads
 * back as a BigInt (#323, #149). A plain Number is still accepted when writing.
 */

const { describe, expect, assert } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

describe('simple struct returnv (fields + inv method)', () => {
  const s = m.simpleStructReturnv()
  expect(s.long, 6n)
  expect(s.int8, 7)
  s.inv() // g_asserts long == 6 && int8 == 7
})

describe('simple struct construction', () => {
  const s = new m.SimpleStruct({ long: 6, int8: 7 })
  expect(s.long, 6n)
  expect(s.int8, 7)
  s.inv()
})

describe('pointer struct returnv (long == 42)', () => {
  const s = m.pointerStructReturnv()
  expect(s.long, 42n)
  s.inv()
})

describe('boxed struct returnv (long/string/gStrv)', () => {
  const s = m.boxedStructReturnv()
  expect(s.long, 42n)
  expect(s.string, 'hello')
  expect(s.gStrv, ['0', '1', '2'])
  s.inv()
})

describe('boxed struct out (long == 42)', () => {
  expect(m.boxedStructOut().long, 42n)
})

describe('boxed struct inout (long 42 -> 0)', () => {
  expect(m.boxedStructInout(m.boxedStructReturnv()).long, 0n)
})

describe('boxed struct out uninitialized (returns false)', () => {
  const [ok] = m.boxedStructOutUninitialized()
  assert(ok === false, `boxedStructOutUninitialized return should be false, got ${ok}`)
})

describe('union returnv (long == 42)', () => {
  expect(m.unionReturnv().long, 42n)
})

describe('array of struct pointers in (none/take)', () => {
  const mk = (n) => { const s = new m.BoxedStruct(); s.long = n; return s }
  m.arrayStructIn([mk(1), mk(2), mk(3)])     // GIMarshallingTestsBoxedStruct **
  m.arrayStructTakeIn([mk(1), mk(2), mk(3)]) // transfer full
})

describe('array of structs by value in', () => {
  const mkS = (n) => { const s = new m.SimpleStruct(); s.long = n; return s }
  const mkB = (n) => { const s = new m.BoxedStruct(); s.long = n; return s }
  m.arraySimpleStructIn([mkS(1), mkS(2), mkS(3)])
  m.arrayStructValueIn([mkB(1), mkB(2), mkB(3)])
})
