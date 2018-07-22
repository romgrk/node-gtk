/*
 * struct__constructor.js
 */


const path = require('path')
const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gdk = gi.require('Gdk')
const Gtk = gi.require('Gtk')
const Gio = gi.require('Gio')
const common = require('./__common__.js')

Gtk.init()

common.describe('with constructor (no arguments)', () => {
  const border = new Gtk.Border()

  console.log('Result:', border)
  common.assert(border instanceof Gtk.Border, 'result not instanceof Gtk.Border')
})

common.describe('with constructor (arguments)', () => {

  common.it('works', () => {
    const gradient = new Gtk.Gradient(0.1, 0.5, 2, 3)
  })

  common.it('fails when missing arguments',
    common.mustThrow('Not enough arguments; expected 4, have 0', () => {
      const gradient = new Gtk.Gradient()
    }))
})

common.describe('without constructor, size > 0', () => {
  const rgba = new Gdk.RGBA()

  console.log('Result:', rgba)
  common.assert(rgba instanceof Gdk.RGBA, 'result not instanceof Gdk.RGBA')
})

common.describe('without constructor, size === 0',
  common.mustThrow('Boxed allocation failed: no constructor found', () => {
    const result = new Gio.SettingsPrivate()
  }))
