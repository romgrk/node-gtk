/*
 * conversion__boxed_double_free.js
 *
 * Regression test for #394: a boxed value obtained from a transfer-full OUT
 * parameter, then passed into a constructor that takes it transfer-full and
 * frees it on its own finalization, must not be double-freed.
 *
 * GstSdp.SDPMessage.newFromText() returns a GstSDPMessage the JS wrapper owns
 * (transfer-full out). GstWebRTC.WebRTCSessionDescription.new() takes that sdp
 * transfer-full and stores it, freeing it when the description is finalized.
 * Without copying the boxed on the way in, both the sdp wrapper and the
 * description free the same GstSDPMessage -> `free(): invalid pointer` (SIGABRT)
 * on garbage collection. node-gtk hands the callee a copy (see
 * CopyBoxedForTransferFullIn / #409), so both can be collected safely.
 *
 * Run with --expose-gc (the test runner does); skipped where the GStreamer
 * webrtc/sdp libraries aren't installed.
 */

const gi = require('../lib/')
const { describe, assert, skip } = require('./__common__.js')

let Gst, GstWebRTC, GstSdp
try {
  Gst = gi.require('Gst', '1.0')
  GstWebRTC = gi.require('GstWebRTC')
  GstSdp = gi.require('GstSdp')
  Gst.init([])
} catch (e) {
  console.log('GStreamer webrtc/sdp not available, skipping:', e.message)
  skip()
}

assert(typeof global.gc === 'function', 'test must run with --expose-gc')

describe('boxed transfer-full IN is not double-freed on GC (#394)', () => {
  const text = 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'

  // Both the sdp wrapper and the description are locals that become
  // collectable together — this is what triggers the double free.
  const build = () => {
    const [ret, sdp] = GstSdp.SDPMessage.newFromText(text)
    assert(ret === 0, `newFromText should succeed, got ${ret}`)
    const desc = new GstWebRTC.WebRTCSessionDescription.new(
      GstWebRTC.WebRTCSDPType.ANSWER, sdp)
    return desc.constructor.name
  }

  assert(build() === 'GstWebRTCSessionDescription',
    'should construct a WebRTCSessionDescription')

  // If the sdp were double-owned, finalizing both here would abort the process.
  global.gc()
  global.gc()
})
