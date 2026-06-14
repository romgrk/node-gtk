/*
 * marshalling__bytes.js
 *
 * Exercises GByteArray and GBytes marshalling using the gobject-introspection
 * GIMarshallingTests library.
 *
 * A GByteArray marshals OUT to a Buffer/Uint8Array (read here via Array.from)
 * and accepts a plain array of byte values IN. A GBytes marshals OUT to a
 * GLib.Bytes object and is constructed with `new GLib.Bytes([...])` for IN.
 */

const gi = require('../lib/')
const GLib = gi.require('GLib', '2.0')
const { describe, expect, assert } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

// { '\0', '1', '\xFF', '3' }
const BYTES = [0, 49, 255, 51]
// bytearray_full_inout replaces the contents with { 'h', 'e', 'l', '\0', '\xFF' }
const BYTES_INOUT_RESULT = [104, 101, 108, 0, 255]

describe('bytearray full return/out', () => {
  expect(Array.from(m.bytearrayFullReturn()), BYTES)
  expect(Array.from(m.bytearrayFullOut()), BYTES)
})

describe('bytearray none in', () => {
  m.bytearrayNoneIn(BYTES)
})

describe('bytearray full inout (-> [h,e,l,0,255])', () => {
  expect(Array.from(m.bytearrayFullInout(BYTES)), BYTES_INOUT_RESULT)
})

describe('gbytes full return', () => {
  const bytes = m.gbytesFullReturn()
  // g_bytes_get_size returns a gsize, which is 64-bit on LP64 and marshalled
  // as BigInt (#323, #149).
  assert(bytes.getSize() === 4n, `gbytes size should be 4, got ${bytes.getSize()}`)
})

describe('gbytes none in', () => {
  m.gbytesNoneIn(new GLib.Bytes(BYTES))
})
