/*
 * function_call__multiple_return.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk')

const button = new Gtk.Button()
console.log(button.getSizeRequest())
