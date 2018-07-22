/*
 * function_call__throws_missing_args.js
 */

const gi = require('../')
const Gtk = gi.require('Gtk', '3.0');
const common = require('./__common__.js')

let didThrow = false

try {
  Gtk.acceleratorGetLabel()
} catch (e) {
  didThrow = true
  common.assert(e instanceof TypeError)
  console.log('Got expected error:', e.message)
}

common.assert(didThrow)
