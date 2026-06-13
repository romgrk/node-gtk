/*
 * marshalling__garray.js
 *
 * Exercises GArray and GPtrArray marshalling in every direction and across
 * transfer modes using the gobject-introspection GIMarshallingTests library.
 * Both marshal to/from plain JS arrays.
 *
 * KNOWN ISSUE (skip()'d below): GPtrArray IN/inout marshalling is unimplemented
 * and aborts at value.cc:823 (#401). GPtrArray OUT/return work fine; GArray
 * works in every direction.
 */

const { describe, expect, skip } = require('./__common__.js')
const { requireGIMarshallingTests } = require('./__gi-fixtures__.js')

const m = requireGIMarshallingTests()

const INTS = [-1, 0, 1, 2]
const STRS = ['0', '1', '2']
const UTF8_INOUT_RESULT = ['-2', '-1', '0', '1']

describe('garray int (none) return/in', () => {
  expect(m.garrayIntNoneReturn(), INTS)
  m.garrayIntNoneIn(INTS)
})

describe('garray utf8 return (none/full/container)', () => {
  expect(m.garrayUtf8NoneReturn(), STRS)
  expect(m.garrayUtf8FullReturn(), STRS)
  expect(m.garrayUtf8ContainerReturn(), STRS)
})

describe('garray utf8 out (none)', () => {
  expect(m.garrayUtf8NoneOut(), STRS)
})

describe('garray utf8 in (none/full/container)', () => {
  m.garrayUtf8NoneIn(STRS)
  m.garrayUtf8FullIn(STRS)
  m.garrayUtf8ContainerIn(STRS)
})

describe('garray utf8 inout (none -> [-2,-1,0,1])', () => {
  expect(m.garrayUtf8NoneInout(STRS), UTF8_INOUT_RESULT)
})

describe('gptrarray utf8 return/out (none/full)', () => {
  expect(m.gptrarrayUtf8NoneReturn(), STRS)
  expect(m.gptrarrayUtf8FullReturn(), STRS)
  expect(m.gptrarrayUtf8NoneOut(), STRS)
})

// Everything below crashes — see the file header.
skip()

// #401 — GPtrArray IN/inout marshalling is unimplemented (value.cc:823).
describe('gptrarray utf8 in/inout (#401)', () => {
  m.gptrarrayUtf8NoneIn(STRS)
  m.gptrarrayUtf8NoneInout(STRS)
})
