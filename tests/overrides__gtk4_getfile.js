/*
 * overrides__gtk4_getfile.js
 *
 * Regression test: Gtk4 FileChooser getFile() override must not crash when
 * no file is selected. gtk_file_chooser_get_file() returns NULL in that
 * case, and the override unconditionally did `file.__proto__ = ...`.
 */

const gi = require('../lib/')
const { describe, it, expect, skip } = require('./__common__.js')

let Gtk
try {
  Gtk = gi.require('Gtk', '4.0')
  Gtk.init()
} catch (e) {
  console.log('Gtk 4.0 not available, skipping:', e.message)
  skip()
}

describe('Gtk4 FileChooser.getFile', () => {
  it('returns null instead of throwing when nothing is selected', () => {
    const chooser = new Gtk.FileChooserWidget({ action: Gtk.FileChooserAction.OPEN })
    const file = chooser.getFile()
    expect(file, null)
  })
})
