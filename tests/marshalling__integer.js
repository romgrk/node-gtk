/*
 * marshalling__integer.js
 *
 * Exercises integer marshalling across widths and directions using the
 * gobject-introspection GIMarshallingTests library.
 *
 * The library's `*_in` functions g_assert their argument equals a canonical
 * value, so we feed them the library's own `*ReturnMax`/`*ReturnMin` values:
 * this keeps the test self-consistent and avoids hardcoding bound literals.
 *
 * 64-bit widths (long, int64, ssize, ...) round-trip through a JS double and
 * lose precision past Number.MAX_SAFE_INTEGER, so their `in`/`inout` variants
 * are skipped here (feeding back a lossy value would abort the process). Their
 * `return`/`out` values are still checked, including the documented precision
 * limitation.
 */

const { describe, it, expect, assert } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

// Widths that expose ReturnMax/ReturnMin in GIMarshallingTests.
const WIDTHS = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32',
                'int64', 'uint64', 'short', 'ushort', 'int', 'uint',
                'long', 'ulong', 'ssize', 'size']

WIDTHS.forEach(w => {
  const returnMax = m[w + 'ReturnMax']
  const returnMin = m[w + 'ReturnMin']
  if (typeof returnMax !== 'function')
    return // not all widths exist in every GI version

  describe(`${w} return/out`, () => {
    const max = returnMax()
    assert(typeof max === 'number', `${w}ReturnMax should be a number`)

    if (m[w + 'OutMax'])
      expect(m[w + 'OutMax'](), max)
    if (typeof returnMin === 'function' && m[w + 'OutMin'])
      expect(m[w + 'OutMin'](), returnMin())
  })

  const max = returnMax()
  const safe = Number.isSafeInteger(max)

  it(`${w} in/inout (safe-integer only)`, () => {
    if (!safe)
      return // 64-bit: JS double can't represent the bound exactly

    if (m[w + 'InMax']) m[w + 'InMax'](max)
    if (typeof returnMin === 'function' && m[w + 'InMin']) m[w + 'InMin'](returnMin())

    if (m[w + 'InoutMaxMin'] && typeof returnMin === 'function')
      expect(m[w + 'InoutMaxMin'](max), returnMin())
    if (m[w + 'InoutMinMax'] && typeof returnMin === 'function')
      expect(m[w + 'InoutMinMax'](returnMin()), max)
  })
})

describe('gint return/out/inout (explicit bounds)', () => {
  expect(m.intReturnMax(), 2147483647)
  expect(m.intReturnMin(), -2147483648)
  expect(m.intOutMax(), 2147483647)
  expect(m.intInoutMaxMin(2147483647), -2147483648)
})
