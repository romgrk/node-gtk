/*
 * function_call__throws_missing_args.js
 */
/* global test, expect */

const gi = require('../')
const Gtk = gi.require('Gtk', '3.0');

test('fills caller-allocated arguments', () => {
  expect(() => {
    Gtk.accelerator_get_label();
  }).toThrow();
})
