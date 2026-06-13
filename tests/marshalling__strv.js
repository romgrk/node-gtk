/*
 * marshalling__strv.js
 *
 * Exercises zero-terminated and length-counted C string array (gchar**)
 * marshalling using the gobject-introspection GIMarshallingTests library.
 * These marshal to/from plain JS arrays of strings.
 */

const { describe, expect } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

const STRS = ['0', '1', '2']

describe('zero-terminated string array return/out', () => {
  expect(m.arrayZeroTerminatedReturn(), STRS)
  expect(m.arrayZeroTerminatedOut(), STRS)
})

describe('zero-terminated string array return null (-> [])', () => {
  expect(m.arrayZeroTerminatedReturnNull(), [])
})

describe('zero-terminated string array in', () => {
  m.arrayZeroTerminatedIn(STRS)
})

describe('zero-terminated string array inout (-> [-1,0,1,2])', () => {
  expect(m.arrayZeroTerminatedInout(STRS), ['-1', '0', '1', '2'])
})

describe('length-counted string array in (["foo","bar"])', () => {
  m.arrayStringIn(['foo', 'bar'])
})
