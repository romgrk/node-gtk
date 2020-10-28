/*
 * error.js
 */


const gi = require('../lib/')
const GLib = gi.require('GLib', '2.0')
const Gst = gi.require('Gst', '1.0')
const common = require('./__common__.js')

Gst.init()

const ERROR_MESSAGE = 'ERROR_MESSAGE'
const ERROR_CODE = 42
const DEBUG_STRING = 'debug string'

common.describe('GError', () => {
  common.it('should be returned', () => {
    common.assert(GLib.Error !== undefined)
    const err0 = GLib.Error.newLiteral(404, ERROR_CODE, ERROR_MESSAGE)
    common.assert(err0.code === ERROR_CODE && err0.message === ERROR_MESSAGE)

    const msg = Gst.Message.newError(null, err0, DEBUG_STRING)
    const [err1, debugString] = msg.parseError();
    common.assert(err1.code === ERROR_CODE && err1.message === ERROR_MESSAGE)
    common.assert(debugString === DEBUG_STRING)
  })
})
