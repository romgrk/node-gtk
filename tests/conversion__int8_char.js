/*
 * conversion__int8_char.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')

const common = require('./__common__.js')

gi.startLoop()
Gtk.init()
Gdk.init([])

common.it('converts int8[] to char* automatically', () => {
  const css = new Gtk.CssProvider()
  css.loadFromData(`
    button {
      padding: 20px;
    }
  `)
})
