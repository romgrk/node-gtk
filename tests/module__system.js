/*
 * module__system.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk')
const common = require('./__common__.js')
const system = gi.System

Gtk.init()

common.describe('system', () => {
  // common.it('.breakpoint()', () => {
    // system.breakpoint()
  // })

  common.it('.refCount()', () => {
    const btn = new Gtk.Button()
    const result = system.refCount(btn)
    common.assert(result > 0, 'refCount() result isnt valid: ' + result)
  })

  common.it('.internalFieldCount()', () => {
    const btn = new Gtk.Button()
    const result = system.internalFieldCount(btn)
    common.assert(result === 1, 'internalFieldCount() result isnt valid: ' + result)
  })

  common.it('.addressOf()', () => {
    const btn = new Gtk.Button()
    const result = system.addressOf(btn)
    console.log('0x' + result.toString(16))
    common.assert(
      typeof result === 'number' && result > 0,
      'internalFieldCount() result isnt valid: ' + result
    )
  })
})
