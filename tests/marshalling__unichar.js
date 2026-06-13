/*
 * marshalling__unichar.js
 *
 * Exercises gunichar array marshalling using the gobject-introspection
 * GIMarshallingTests library.
 *
 * Note the input/output asymmetry: node-gtk yields an array of single-character
 * strings when marshalling a gunichar array OUT, but expects an array of
 * numeric codepoints when marshalling one IN.
 */

const { describe, it, expect } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

// GI_MARSHALLING_TESTS_CONSTANT_UCS4 == "const ♥ utf8" as codepoints
const CHARS = Array.from('const ♥ utf8')             // ['c', 'o', ..., '♥', ...]
const CODEPOINTS = CHARS.map(c => c.codePointAt(0))  // [99, 111, ..., 9829, ...]

describe('unichar array out/return (as single-char strings)', () => {
  expect(m.arrayUnicharOut(), CHARS)
  expect(m.arrayZeroTerminatedReturnUnichar(), CHARS)
})

describe('unichar array in (as codepoints)', () => {
  m.arrayUnicharIn(CODEPOINTS)
})
