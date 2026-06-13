/*
 * marshalling__gvalue.js
 *
 * Exercises GValue marshalling in every direction using the
 * gobject-introspection GIMarshallingTests library.
 *
 * node-gtk does not auto-box a JS primitive into a GValue, so the *In / *Inout
 * / *RoundTrip / *Copy functions are driven with an explicitly constructed
 * GObject.Value. A GValue coming back OUT is a GObject.Value whose contents are
 * read with the typed getters (getInt, getInt64, getString, ...).
 *
 * KNOWN ISSUE — returnGvalueFlatArray() and returnGvalueZeroTerminatedArray()
 * (a GValue* treated as a C array of GValue) segfault: node-gtk mismarshals
 * the array-of-GValue return. A segfault is an uncatchable process abort, so
 * those two cases are skip()'d (everything above the skip still runs and stays
 * enforced). Tracked in https://github.com/romgrk/node-gtk/issues/398; remove
 * the skip() once fixed.
 */

const gi = require('../lib/')
const GObject = gi.require('GObject', '2.0')
const { describe, expect, assert, skip } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

function vInt(n) {
  const v = new GObject.Value()
  v.init(GObject.TYPE_INT)
  v.setInt(n)
  return v
}

describe('gvalue return/out (int 42)', () => {
  expect(m.gvalueReturn().getInt(), 42)
  expect(m.gvalueOut().getInt(), 42)
  expect(m.gvalueOutCallerAllocates().getInt(), 42)
})

describe('gvalue int64 out (G_MAXINT64, with double precision loss)', () => {
  // G_MAXINT64 (2^63 - 1) is not exactly representable as a JS double; both
  // sides round identically, so compare against the rounded reference value.
  expect(m.gvalueInt64Out().getInt64(), Number(2n ** 63n - 1n))
})

describe('gvalue int64 in (G_MAXINT64)', () => {
  const v = new GObject.Value()
  v.init(GObject.TYPE_INT64)
  v.setInt64(9223372036854775807n)
  m.gvalueInt64In(v)
})

describe('gvalue in (int 42)', () => {
  m.gvalueIn(vInt(42))
})

describe('gvalue in with modification (42 -> 24, in place)', () => {
  // Modifies the passed-in GValue's int from 42 to 24.
  const v = vInt(42)
  m.gvalueInWithModification(v)
  expect(v.getInt(), 24)
})

describe('gvalue round trip (int 42)', () => {
  expect(m.gvalueRoundTrip(vInt(42)).getInt(), 42)
})

describe('gvalue copy (int 42)', () => {
  expect(m.gvalueCopy(vInt(42)).getInt(), 42)
})

describe('gvalue inout (int 42 -> string "42")', () => {
  expect(m.gvalueInout(vInt(42)).getString(), '42')
})

describe('gvalue noncanonical NaN (float/double)', () => {
  assert(Number.isNaN(m.gvalueNoncanonicalNanFloat().getFloat()),
    'gvalueNoncanonicalNanFloat should hold NaN')
  assert(Number.isNaN(m.gvalueNoncanonicalNanDouble().getDouble()),
    'gvalueNoncanonicalNanDouble should hold NaN')
})

// Everything below segfaults (issue #398) — see the file header.
skip()

describe('gvalue flat array return ([42, "42", true])', () => {
  expect(m.returnGvalueFlatArray(), [42, '42', true])
})

describe('gvalue zero-terminated array return ([42, "42", true])', () => {
  expect(m.returnGvalueZeroTerminatedArray(), [42, '42', true])
})
