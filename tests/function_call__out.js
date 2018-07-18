/*
 * function_call__out.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()

const button = new Gtk.Button()
button.setSizeRequest(100, 50)

const result = button.getSizeRequest()

console.log('Result:', result)
console.assert(result.width  === 100, `result.width  === 100`)
console.assert(result.height === 50,  `result.height === 50`)
