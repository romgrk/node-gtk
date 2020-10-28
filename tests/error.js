/*
 * error.js
 */


const gi = require('../lib/')
const GLib = gi.require('GLib', '2.0')
const Gst = gi.require('Gst', '1.0')
const { describe, it, assert } = require('./__common__.js')

Gst.init()

const QUARK_STRING = 'example'
const CUSTOM_QUARK = GLib.quarkFromString(QUARK_STRING)
const ERROR_MESSAGE = 'ERROR_MESSAGE'
const ERROR_CODE = 42
const DEBUG_STRING = 'debug string'

describe('GError', () => {
  it('should be returned', () => {
    assert(GLib.Error !== undefined, 'Error is not available')
    const err0 = GLib.Error.newLiteral(CUSTOM_QUARK, ERROR_CODE, ERROR_MESSAGE)
    assert(err0.code === ERROR_CODE && err0.message === ERROR_MESSAGE, 'code or message is not accessible')

    const msg = Gst.Message.newError(null, err0, DEBUG_STRING)
    const [err1, debugString] = msg.parseError();
    assert(err1.code === ERROR_CODE && err1.message === ERROR_MESSAGE, 'code or message is not equal')
    assert(debugString === DEBUG_STRING, 'debug string is not returned')
    assert(err1.domain === CUSTOM_QUARK && GLib.quarkToString(err1.domain) === QUARK_STRING, 'domain does not match')
  })
})
