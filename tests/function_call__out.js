/*
 * function_call__out.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const common = require('./__common__.js')

gi.startLoop()
Gtk.init()

const button = new Gtk.Button()
button.setSizeRequest(100, 50)

const result = button.getSizeRequest()

console.log('Result:', result)
common.assert(result.width  === 100, `result.width  === 100`)
common.assert(result.height === 50,  `result.height === 50`)
