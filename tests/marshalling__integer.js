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
 * 64-bit widths (long, int64, ssize, ...) are marshalled as BigInt (#323), so
 * they keep full precision and round-trip exactly in every direction. Narrower
 * widths are plain Numbers.
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
    assert(typeof max === 'number' || typeof max === 'bigint',
      `${w}ReturnMax should be a number or bigint`)

    if (m[w + 'OutMax'])
      expect(m[w + 'OutMax'](), max)
    if (typeof returnMin === 'function' && m[w + 'OutMin'])
      expect(m[w + 'OutMin'](), returnMin())
  })

  const max = returnMax()
  // 64-bit widths come back as BigInt and round-trip exactly; narrower widths
  // are Numbers within the safe-integer range.
  const exact = typeof max === 'bigint' || Number.isSafeInteger(max)

  it(`${w} in/inout`, () => {
    if (!exact)
      return

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

describe('platform-dependent widths are BigInt with full precision', () => {
  // glong/gsize/gssize are 64-bit on LP64 platforms; gobject-introspection
  // resolves them to a fixed-width tag at scan time, so on a 64-bit build they
  // arrive as BigInt and represent G_MAXINT64 exactly (#323, #149). On a 32-bit
  // build they would be plain Numbers, so only assert when a BigInt comes back.
  for (const w of ['long', 'ssize']) {
    const returnMax = m[w + 'ReturnMax']
    if (typeof returnMax !== 'function')
      continue
    const max = returnMax()
    if (typeof max === 'bigint')
      expect(max, 2n ** 63n - 1n)
  }
})
