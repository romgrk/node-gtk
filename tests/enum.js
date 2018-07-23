/*
 * enum.js
 */


const path = require('path')
const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gdk = gi.require('Gdk')
const Gtk = gi.require('Gtk')
const common = require('./__common__.js')

Gtk.init()

common.describe('enum', () => {
  common.it('are defined', () => {
    common.assert(Gtk.Align !== undefined,      'Gtk.Align is undefined')
    common.assert(Gtk.Align.FILL !== undefined, 'Gtk.Align.FILL is undefined')
  })

  common.it('are passed as arguments', () => {
    const btn = new Gtk.Button()
    btn.setHalign(Gtk.Align.CENTER)
    common.expect(btn.halign, Gtk.Align.CENTER)
  })

  common.it('are returned', () => {
    const btn = new Gtk.Button()
    btn.setHalign(Gtk.Align.CENTER)
    const result = btn.getHalign()
    common.expect(result, Gtk.Align.CENTER)
  })
})
