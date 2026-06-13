/*
 * conversion__gvalue_uint64.js
 *
 * Regression test: assigning a 64-bit value to a GObject property whose
 * type is guint64 (or gulong on LP64) must not truncate it to 32 bits.
 * This exercises V8ToGValue, which used Nan::To<uint32_t> for the
 * UINT64/ULONG branches.
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

  // max-size-time is a writable guint64 property (nanoseconds).
  // Use a value above 2^32 but still an exact JS integer (< 2^53).
  const value = 5000000000 // 2^32 == 4294967296

  queue.maxSizeTime = value

  expect(queue.maxSizeTime, value)
})
