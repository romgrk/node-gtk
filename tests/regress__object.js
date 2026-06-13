/*
 * regress__object.js
 *
 * Exercises GObject semantics using the gobject-introspection Regress library:
 * construction, instance/static methods, out-parameter "torture" signatures,
 * properties, subclass inheritance, and boxed types.
 */

const { describe, expect, assert } = require('./__common__.js')
const { requireRegress } = require('./__gi-fixtures__.js')

const R = requireRegress()

describe('TestObj construction (GObject + properties)', () => {
  const o = new R.TestObj()
  expect(o.constructor.name, 'RegressTestObj')
  const o2 = new R.TestObj({ int: 9 })
  expect(o2.int, 9)
})

describe('TestObj instance / static methods', () => {
  expect(new R.TestObj().instanceMethod(), -1)
  expect(R.TestObj.staticMethod(42), 42)
})

describe('TestObj torture signature 0 (out params y=x, z=2x, q=len(foo)+m)', () => {
  // (int x, out double y, out int z, const char *foo, out int q, guint m)
  expect(new R.TestObj().tortureSignature0(5, 'hello', 3), [5, 10, 8])
})

describe('TestObj string get/set (method + property)', () => {
  const o = new R.TestObj()
  o.setString('hi')
  expect(o.getString(), 'hi')
  o.string = 'viaprop'
  expect(o.string, 'viaprop')
})

describe('TestObj numeric properties (int/double)', () => {
  const o = new R.TestObj()
  o.int = 7
  expect(o.int, 7)
  o.double = 1.5
  expect(o.double, 1.5)
})

describe('TestSubObj inheritance', () => {
  const sub = new R.TestSubObj()
  expect(sub.constructor.name, 'RegressTestSubObj')
  assert(sub instanceof R.TestObj, 'TestSubObj should be an instance of TestObj')
  // TestSubObj overrides instance_method to return 0 (TestObj returns -1).
  expect(sub.instanceMethod(), 0)
})

describe('TestSimpleBoxedA const return / equals / copy', () => {
  // { some_int: 5, some_int8: 6, some_double: 7.0, some_enum: VALUE1 }
  const a = R.TestSimpleBoxedA.constReturn()
  expect(a.someInt, 5)
  expect(a.someInt8, 6)
  expect(a.someDouble, 7.0)
  expect(a.someEnum, 0)

  const b = R.TestSimpleBoxedA.constReturn()
  assert(a.equals(b), 'two const-returned boxed A should be equal')
  assert(a.equals(a.copy()), 'a boxed A should equal its copy')
})
