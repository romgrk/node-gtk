/*
 * marshalling__gtype.js
 *
 * Exercises GType marshalling in every direction using the
 * gobject-introspection GIMarshallingTests library.
 *
 * node-gtk marshals a GType to/from a JS BigInt. The values below are the
 * canonical fundamental type ids from GObject (G_TYPE_* = <fundamental> << 2).
 */

const { describe, it, expect, assert } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

const G_TYPE_NONE = 4n    // 1 << 2
const G_TYPE_INT = 24n    // 6 << 2
const G_TYPE_STRING = 64n // 16 << 2

describe('gtype return/out (G_TYPE_NONE)', () => {
  assert(m.gtypeReturn() === G_TYPE_NONE, `gtypeReturn should be ${G_TYPE_NONE}, got ${m.gtypeReturn()}`)
  assert(m.gtypeOut() === G_TYPE_NONE, `gtypeOut should be ${G_TYPE_NONE}, got ${m.gtypeOut()}`)
})

describe('gtype string return/out (G_TYPE_STRING)', () => {
  assert(m.gtypeStringReturn() === G_TYPE_STRING, `gtypeStringReturn should be ${G_TYPE_STRING}`)
  assert(m.gtypeStringOut() === G_TYPE_STRING, `gtypeStringOut should be ${G_TYPE_STRING}`)
})

describe('gtype in', () => {
  m.gtypeIn(m.gtypeReturn())
  m.gtypeStringIn(m.gtypeStringReturn())
})

describe('gtype inout (NONE -> INT)', () => {
  assert(m.gtypeInout(G_TYPE_NONE) === G_TYPE_INT,
    `gtypeInout(${G_TYPE_NONE}) should be ${G_TYPE_INT}, got ${m.gtypeInout(G_TYPE_NONE)}`)
})
