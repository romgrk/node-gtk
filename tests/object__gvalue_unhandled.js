/*
 * object__gvalue_unhandled.js
 *
 * Converting a GValue whose type node-gtk can't unbox (e.g. GStreamer's
 * GstValueArray) must not abort the process; it warns and returns null (#389).
 */

const gi = require('../lib')
const GObject = gi.require('GObject', '2.0')
const { describe, it, expect, assert, skip } = require('./__common__.js')

let Gst
try {
  Gst = gi.require('Gst', '1.0')
  Gst.init([])
} catch (e) {
  // GStreamer not available on this platform; nothing to exercise.
  skip()
}

describe('GValueToV8 degrades gracefully for unconvertible types (#389)', () => {
  it('returns null instead of aborting on a GstValueArray GValue', () => {
    const gstValueArray = GObject.typeFromName('GstValueArray')
    assert(typeof gstValueArray === 'bigint' && gstValueArray !== 0n,
      'GstValueArray type should be registered after Gst.init')

    const value = new GObject.Value()
    value.init(gstValueArray)

    // getBoxed() -> system.convertGValue() -> GValueToV8(). Previously this
    // hit g_assert_not_reached() and aborted the process.
    expect(value.getBoxed(), null)
  })
})
