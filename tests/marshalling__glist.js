/*
 * marshalling__glist.js
 *
 * Exercises GList and GSList marshalling in every direction and across transfer
 * modes (none/full/container) using the gobject-introspection GIMarshallingTests
 * library. Both list types marshal to/from plain JS arrays.
 *
 * KNOWN ISSUE (skip()'d below, kept for when it's fixed):
 *   - transfer-container IN corrupts the heap (#399)
 */

const { describe, expect, assert, skip } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

const INTS = [-1, 0, 1, 2]
const STRS = ['0', '1', '2']
const INOUT_RESULT = ['-2', '-1', '0', '1']

describe('glist int (none) return/in', () => {
  expect(m.glistIntNoneReturn(), INTS)
  m.glistIntNoneIn(INTS)
})

describe('glist utf8 return/out (none/full/container)', () => {
  expect(m.glistUtf8NoneReturn(), STRS)
  expect(m.glistUtf8FullReturn(), STRS)
  expect(m.glistUtf8ContainerReturn(), STRS)
  expect(m.glistUtf8NoneOut(), STRS)
  expect(m.glistUtf8FullOut(), STRS)
  expect(m.glistUtf8ContainerOut(), STRS)
})

describe('glist utf8 in (none/full)', () => {
  m.glistUtf8NoneIn(STRS)
  m.glistUtf8FullIn(STRS)
})

describe('glist utf8 inout (none/full/container -> [-2,-1,0,1])', () => {
  expect(m.glistUtf8NoneInout(STRS), INOUT_RESULT)
  expect(m.glistUtf8FullInout(STRS), INOUT_RESULT)
  expect(m.glistUtf8ContainerInout(STRS), INOUT_RESULT)
})

describe('gslist int (none) return/in', () => {
  expect(m.gslistIntNoneReturn(), INTS)
  m.gslistIntNoneIn(INTS)
})

describe('gslist utf8 return/out (none/full/container)', () => {
  expect(m.gslistUtf8NoneReturn(), STRS)
  expect(m.gslistUtf8FullReturn(), STRS)
  expect(m.gslistUtf8ContainerReturn(), STRS)
  expect(m.gslistUtf8NoneOut(), STRS)
  expect(m.gslistUtf8FullOut(), STRS)
  expect(m.gslistUtf8ContainerOut(), STRS)
})

describe('gslist utf8 in (none/full)', () => {
  m.gslistUtf8NoneIn(STRS)
  m.gslistUtf8FullIn(STRS)
})

describe('gslist utf8 inout (none/full/container -> [-2,-1,0,1])', () => {
  expect(m.gslistUtf8NoneInout(STRS), INOUT_RESULT)
  expect(m.gslistUtf8FullInout(STRS), INOUT_RESULT)
  expect(m.gslistUtf8ContainerInout(STRS), INOUT_RESULT)
})

// These return FALSE and leave the (out) list pointer untouched (NULL); the
// binding must not dereference it, and marshals it to an empty array.
describe('glist/gslist utf8 none out uninitialized (returns [false, []])', () => {
  const [glistOk, glistVal] = m.glistUtf8NoneOutUninitialized()
  assert(glistOk === false, `glistUtf8NoneOutUninitialized return should be false, got ${glistOk}`)
  expect(glistVal, [])
  const [gslistOk, gslistVal] = m.gslistUtf8NoneOutUninitialized()
  assert(gslistOk === false, `gslistUtf8NoneOutUninitialized return should be false, got ${gslistOk}`)
  expect(gslistVal, [])
})

// Everything below crashes — see the file header.
skip()

// #399 — transfer-container IN corrupts the heap (double/invalid free).
describe('glist/gslist utf8 container in (#399)', () => {
  m.glistUtf8ContainerIn(STRS)
  m.gslistUtf8ContainerIn(STRS)
})
