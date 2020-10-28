/*
 * error.js
 */


const gi = require('../lib/')
const GLib = gi.require('GLib', '2.0')
const Gst = gi.require('Gst', '1.0')
const { describe, it, assert, expect } = require('./__common__.js')

Gst.init()

const QUARK_STRING = 'example'
const CUSTOM_QUARK = GLib.quarkFromString(QUARK_STRING)
const ERROR_MESSAGE = 'ERROR_MESSAGE'
const ERROR_CODE = 42
const DEBUG_STRING = 'debug string'

describe('GError', () => {
  it('should exist', () => {
    assert(GLib.Error !== undefined, 'Error is not available')
  })

  it('should be created from literal', () => {
    const err = GLib.Error.newLiteral(CUSTOM_QUARK, ERROR_CODE, ERROR_MESSAGE)
    expect(err.domain, CUSTOM_QUARK)
    expect(err.code, ERROR_CODE)
    expect(err.message, ERROR_MESSAGE)
  })

  it('should be returned from parseError', () => {
    const err0 = GLib.Error.newLiteral(CUSTOM_QUARK, ERROR_CODE, ERROR_MESSAGE)
    const msg = Gst.Message.newError(null, err0, DEBUG_STRING)
    const [err1, debugString] = msg.parseError()
    expect(err1.domain, CUSTOM_QUARK)
    expect(err1.code, ERROR_CODE)
    expect(err1.message, ERROR_MESSAGE)
    expect(debugString, DEBUG_STRING)
    expect(GLib.quarkToString(err1.domain), QUARK_STRING)
  })
})
