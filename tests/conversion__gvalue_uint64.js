/*
 * conversion__gvalue_uint64.js
 *
 * Regression test: assigning a 64-bit value to a GObject property whose
 * type is guint64 (or gulong on LP64) must not truncate it. 64-bit values are
 * read back as BigInt (#323, #149), so they keep full precision past
 * Number.MAX_SAFE_INTEGER. This exercises V8ToGValue / GValueToV8.
 */

const gi = require('../lib/')
const { describe, expect, skip } = require('./__common__.js')

let Gst
try {
  Gst = gi.require('Gst', '1.0')
  Gst.init([])
} catch (e) {
  console.log('Gst not available, skipping:', e.message)
  skip()
}

describe('GValue 64-bit property assignment', () => {
  const queue = Gst.ElementFactory.make('queue', 'queue0')

  // max-size-time is a writable guint64 property (nanoseconds). A Number above
  // 2^32 is accepted on the way in and read back as a BigInt.
  queue.maxSizeTime = 5000000000 // 2^32 == 4294967296
  expect(queue.maxSizeTime, 5000000000n)

  // A value above Number.MAX_SAFE_INTEGER round-trips exactly via BigInt;
  // this would have lost precision when marshalled through a Number.
  const huge = 9007199254740993n // 2^53 + 1
  queue.maxSizeTime = huge
  expect(queue.maxSizeTime, huge)
})
