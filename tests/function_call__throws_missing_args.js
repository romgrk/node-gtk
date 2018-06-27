/*
 * function_call__throws_missing_args.js
 */

const gi = require('../')
const Gtk = gi.require('Gtk', '3.0');

let didThrow = false

try {
  Gtk.accelerator_get_label()
} catch (e) {
  didThrow = true
  console.assert(e instanceof TypeError)
  console.log('Got expected error:', e.message)
}

console.assert(didThrow)
