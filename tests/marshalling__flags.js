/*
 * marshalling__flags.js
 *
 * Exercises flags marshalling in every direction using the
 * gobject-introspection GIMarshallingTests library, for a registered GFlags,
 * a no-GType flags type, and a flags type with a large (1 << 31) member.
 *
 * As with enums, the *In / *Inout functions g_assert their argument (a wrong
 * value aborts the process), so we drive them with the library's own members.
 */

const { describe, expect } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

// VALUE1 = 1, VALUE2 = 2, VALUE3 = 4, MASK = MASK2 = 3
const F = m.Flags
const N = m.NoTypeFlags
const X = m.ExtraFlags // VALUE1 = 0, VALUE2 = 1 << 31

describe('flags return/out (VALUE2)', () => {
  expect(m.flagsReturnv(), F.VALUE2)
  expect(m.flagsOut(), F.VALUE2)
  expect(m.noTypeFlagsReturnv(), N.VALUE2)
  expect(m.noTypeFlagsOut(), N.VALUE2)
})

describe('flags in (VALUE2)', () => {
  m.flagsIn(F.VALUE2)
  m.noTypeFlagsIn(N.VALUE2)
})

describe('flags in zero', () => {
  m.flagsInZero(0)
  m.noTypeFlagsInZero(0)
})

describe('flags inout (VALUE2 -> VALUE1)', () => {
  expect(m.flagsInout(F.VALUE2), F.VALUE1)
  expect(m.noTypeFlagsInout(N.VALUE2), N.VALUE1)
})

describe('flags array in ([VALUE1, VALUE2, VALUE3])', () => {
  m.arrayFlagsIn([F.VALUE1, F.VALUE2, F.VALUE3])
})

describe('extra flags large in (1 << 31)', () => {
  m.extraFlagsLargeIn(X.VALUE2)
})
