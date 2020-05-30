/*
 * enum.js
 */


const path = require('path')
const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gdk = gi.require('Gdk')
const Gtk = gi.require('Gtk')
const Gst = gi.require('Gst')
const common = require('./__common__.js')

Gtk.init()
Gst.init()

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
    const align = btn.getHalign()
    common.expect(align, Gtk.Align.CENTER)
    console.log({ align })
  })

  common.it('are return as output arguments', () => {
    const oldState = Gst.State.NULL
    const newState = Gst.State.PLAYING
    const pendingState = Gst.State.READY
    const msg = Gst.Message.newStateChanged(null, oldState, newState, pendingState)
    const [oldState_, newState_, pendingState_] = msg.parseStateChanged()
    common.expect(oldState_, oldState)
    common.expect(newState_, newState)
    common.expect(pendingState_, pendingState)
  })
})
