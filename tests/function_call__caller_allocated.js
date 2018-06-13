/*
 * function_call__caller_allocated.js
 */
/* global test, expect */

const gi = require('../')
const Gtk = gi.require('Gtk', '3.0');

test('fills caller-allocated arguments', () => {
  const buf = new Gtk.TextBuffer();
  const i = buf.getStartIter(/* TextIter */);
  expect(i.__proto__ === Gtk.TextIter.prototype).toBe(true)
  expect(i instanceof Gtk.TextIter).toBe(true)
})
