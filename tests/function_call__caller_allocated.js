/*
 * function_call__caller_allocated.js
 */

const gi = require('../')
const Gtk = gi.require('Gtk', '3.0')
const common = require('./__common__.js')

const buffer = new Gtk.TextBuffer()
const iter = buffer.getStartIter(/* TextIter */)
common.assert(iter !== undefined, 'iter !== undefined')
common.assert(iter.__proto__ === Gtk.TextIter.prototype, 'iter.__proto__ === Gtk.TextIter.prototype')
common.assert(iter instanceof Gtk.TextIter, 'iter instanceof Gtk.TextIter')
console.log('Success:', iter)
