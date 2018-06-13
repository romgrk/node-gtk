/*
 * function_call__inout.js
 */

const gi = require('../lib')
const Gtk = gi.require('Gtk', '3.0');

const result = Gtk.init(['argument1', '--gtk-debug', 'misc', 'argument2'])

if (result.length !== 2) {
  console.error(result, 'expected length === 2')
  process.exit(1)
}
