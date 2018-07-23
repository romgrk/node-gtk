/*
 * flags.js
 */


const path = require('path')
const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gdk = gi.require('Gdk')
const Gtk = gi.require('Gtk')
const common = require('./__common__.js')

Gtk.init()

common.describe('flags', () => {
  common.it('are defined', () => {
    common.assert(Gtk.AccelFlags !== undefined,         'Gtk.AccelFlags is undefined')
    common.assert(Gtk.AccelFlags.VISIBLE !== undefined, 'Gtk.AccelFlags.VISIBLE is undefined')
  })

  common.it('are returned', () => {
    const btn = new Gtk.Button()
    const result = btn.getModifierMask(Gdk.ModifierIntent.PRIMARY_ACCELERATOR)
    common.expect(result, Gdk.ModifierType.CONTROL_MASK)
  })
})
