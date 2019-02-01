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
    common.assert(/0x[0-9a-fA-F]{2,}/.test(result), 'internalFieldCount() result isnt valid: ' + result)
  })
})
