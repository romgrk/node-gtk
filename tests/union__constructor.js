/*
 * union__constructor.js
 */


const path = require('path')
const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gdk = gi.require('Gdk')
const Gtk = gi.require('Gtk')
const Gio = gi.require('Gio')
const common = require('./__common__.js')

Gtk.init()

// common.describe('with constructor (no arguments)', () => {
  // No example found
// })

common.describe('with constructor (arguments)', () => {

  common.it('works', () => {
    const event = new Gdk.Event(Gdk.EventType.KEY_PRESS)
  })

  common.it('fails when missing arguments',
    common.mustThrow('Not enough arguments; expected 1, have 0', () => {
      const event = new Gdk.Event()
    }))
})

common.describe('without constructor, size > 0', () => {
  const tokenValue = new GLib.TokenValue()
})

// common.describe('without constructor, size === 0',
  // common.mustThrow('Boxed allocation failed: no constructor found', () => {
    // No example found
  // }))
