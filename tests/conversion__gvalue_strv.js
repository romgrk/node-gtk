/*
 * conversion__gvalue_strv.js
 *
 * Regression test for #175 / #369: assigning a JS array to a GObject property
 * whose type is GStrv (a NULL-terminated char**) must work. GStrv is a boxed
 * type, so before the fix it fell into the generic G_VALUE_HOLDS_BOXED branch
 * in value.cc and threw `Cannot convert value "[object Array]" to type GStrv`.
 *
 * Exercises both directions: V8ToGValue (set) and GValueToV8 (get).
 */

const gi = require('../lib/')
const { describe, expect, skip } = require('./__common__.js')

let Gtk
try {
  Gtk = gi.require('Gtk', '3.0')
  Gtk.init([])
} catch (e) {
  console.log('Gtk not available, skipping:', e.message)
  skip()
}

describe('GStrv property via construct property', () => {
  // `authors` is a writable GStrv property on GtkAboutDialog (the #369 case).
  const dialog = new Gtk.AboutDialog({ authors: ['Ada Lovelace', 'Alan Turing'] })
  expect(dialog.authors, ['Ada Lovelace', 'Alan Turing'])
})

describe('GStrv property via setter', () => {
  const dialog = new Gtk.AboutDialog()
  dialog.authors = ['Grace Hopper']
  expect(dialog.authors, ['Grace Hopper'])
})

describe('GStrv property with an empty array', () => {
  const dialog = new Gtk.AboutDialog({ authors: [] })
  expect(dialog.authors, [])
})
