/*
 * function_call__caller_allocated.js
 */

const gi = require('../')
const Gtk = gi.require('Gtk', '3.0')
const common = require('./__common__.js')

Gtk.init()

const name = 'custom-mark'

const buffer = new Gtk.TextBuffer()
const mark = new Gtk.TextMark({ name })
const iter = buffer.getStartIter(/* TextIter */)

common.assert(iter !== undefined, 'iter !== undefined')
common.assert(iter.__proto__ === Gtk.TextIter.prototype, 'iter.__proto__ === Gtk.TextIter.prototype')
common.assert(iter instanceof Gtk.TextIter, 'iter instanceof Gtk.TextIter')

buffer.addMark(mark, iter)

const returnedMark = buffer.getMark(name)

common.assert(mark === returnedMark, 'mark === returnedMark')

console.log('Success:', iter, returnedMark)
