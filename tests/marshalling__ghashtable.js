/*
 * marshalling__ghashtable.js
 *
 * Exercises GHashTable marshalling in every direction and across transfer
 * modes using the gobject-introspection GIMarshallingTests library. A
 * GHashTable marshals to/from a plain JS object (keys are stringified).
 *
 * KNOWN ISSUE (skip()'d below, kept for when it's fixed):
 *   - transfer-container IN corrupts the heap (#399)
 */

const { describe, expect, assert, skip } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

const INT_HASH = { '-1': 1, '0': 0, '1': -1, '2': -2 }
const UTF8_HASH = { '-1': '1', '0': '0', '1': '-1', '2': '-2' }
const UTF8_INOUT_RESULT = { '-1': '1', '0': '0', '1': '1' }

describe('ghashtable int (none) return', () => {
  expect(m.ghashtableIntNoneReturn(), INT_HASH)
})

describe('ghashtable utf8 return/out (none)', () => {
  expect(m.ghashtableUtf8NoneReturn(), UTF8_HASH)
  expect(m.ghashtableUtf8NoneOut(), UTF8_HASH)
})

describe('ghashtable utf8 in (none/full)', () => {
  m.ghashtableUtf8NoneIn(UTF8_HASH)
  m.ghashtableUtf8FullIn(UTF8_HASH)
})

describe('ghashtable utf8 inout (none)', () => {
  expect(m.ghashtableUtf8NoneInout(UTF8_HASH), UTF8_INOUT_RESULT)
})

// Integer-keyed/valued GHashTable IN — keys/values packed via GINT_TO_POINTER.
describe('ghashtable int none in', () => {
  m.ghashtableIntNoneIn(INT_HASH)
})

// Returns FALSE and leaves the (out) table pointer untouched (NULL); the
// binding must not dereference it, and marshals it to an empty object.
describe('ghashtable utf8 container out uninitialized (returns [false, {}])', () => {
  const [ok, value] = m.ghashtableUtf8ContainerOutUninitialized()
  assert(ok === false, `ghashtableUtf8ContainerOutUninitialized return should be false, got ${ok}`)
  expect(value, {})
})

// Everything below crashes — see the file header.
skip()

// #399 — transfer-container IN corrupts the heap.
describe('ghashtable utf8 container in (#399)', () => {
  m.ghashtableUtf8ContainerIn(UTF8_HASH)
})
