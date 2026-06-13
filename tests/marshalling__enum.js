/*
 * marshalling__enum.js
 *
 * Exercises enum marshalling in every direction using the
 * gobject-introspection GIMarshallingTests library, for both a plain
 * (no-GType) enum and a registered GEnum.
 *
 * The library's *In / *Inout functions g_assert their argument equals a
 * canonical value (a wrong value aborts the whole process, uncatchably), so
 * we drive them with the library's own VALUE1/VALUE2/VALUE3 members.
 */

const { describe, expect, assert } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

// VALUE1 = 0, VALUE2 = 1, VALUE3 = 42
const E = m.Enum
const G = m.GEnum

describe('enum return/out (VALUE3)', () => {
  expect(m.enumReturnv(), E.VALUE3)
  expect(m.enumOut(), E.VALUE3)
  expect(m.genumReturnv(), G.VALUE3)
  expect(m.genumOut(), G.VALUE3)
})

describe('enum in (VALUE3)', () => {
  m.enumIn(E.VALUE3)
  m.genumIn(G.VALUE3)
})

describe('enum inout (VALUE3 -> VALUE1)', () => {
  expect(m.enumInout(E.VALUE3), E.VALUE1)
  expect(m.genumInout(G.VALUE3), G.VALUE1)
})

describe('enum array in ([VALUE1, VALUE2, VALUE3])', () => {
  m.arrayEnumIn([E.VALUE1, E.VALUE2, E.VALUE3])
})

describe('enum out uninitialized (returns false)', () => {
  // gboolean return is FALSE; the out param is left untouched.
  const [ok] = m.enumOutUninitialized()
  assert(ok === false, `enumOutUninitialized return should be false, got ${ok}`)
})
