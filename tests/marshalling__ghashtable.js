/*
 * marshalling__ghashtable.js
 *
 * Exercises GHashTable marshalling in every direction and across transfer
 * modes using the gobject-introspection GIMarshallingTests library. A
 * GHashTable marshals to/from a plain JS object (keys are stringified).
 *
 * KNOWN ISSUES (skip()'d below, kept for when they're fixed):
 *   - integer-keyed/valued GHashTable IN segfaults (#402)
 *   - transfer-container IN corrupts the heap (#399)
 *   - *OutUninitialized out-params segfault (#400)
 */

const { describe, expect, skip } = require('./__common__.js')
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

// Everything below crashes — see the file header.
skip()

// #402 — integer GHashTable IN segfaults (value-vs-pointer packing).
describe('ghashtable int none in (#402)', () => {
  m.ghashtableIntNoneIn(INT_HASH)
})

// #399 — transfer-container IN corrupts the heap.
describe('ghashtable utf8 container in (#399)', () => {
  m.ghashtableUtf8ContainerIn(UTF8_HASH)
})

// #400 — uninitialized pointer out-param is marshalled anyway, segfault.
describe('ghashtable utf8 container out uninitialized (#400)', () => {
  m.ghashtableUtf8ContainerOutUninitialized()
})
