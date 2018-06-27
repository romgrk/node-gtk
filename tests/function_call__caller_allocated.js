/*
 * function_call__caller_allocated.js
 */

const gi = require('../')
const Gtk = gi.require('Gtk', '3.0')

const buffer = new Gtk.TextBuffer()
const iter = buffer.getStartIter(/* TextIter */)
console.assert(iter !== undefined, 'iter !== undefined')
console.assert(iter.__proto__ === Gtk.TextIter.prototype, 'iter.__proto__ === Gtk.TextIter.prototype')
console.assert(iter instanceof Gtk.TextIter, 'iter instanceof Gtk.TextIter')
console.log('Success:', iter)
