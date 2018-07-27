/*
 * glist.js
 */

const gi = require('../lib/')
const Soup = gi.require('Soup')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GdkPixbuf = gi.require('GdkPixbuf')
const common = require('./__common__.js')

gi.startLoop()
Gtk.init()

common.describe('GSList conversion', () => {
  common.it('works for arguments and return values', () => {

    const icons = [
      new GdkPixbuf.Pixbuf(),
      new GdkPixbuf.Pixbuf(),
      new GdkPixbuf.Pixbuf(),
    ]

    const window = new Gtk.Window()
    window.setIconList(icons)
    const result = window.getIconList()
    console.log('Result:', result)
    common.assert(result.length === 3, 'result.length is not 3')
    common.assert(result[0] instanceof GdkPixbuf.Pixbuf, 'result[0] not instanceof GdkPixbuf.Pixbuf')
    common.assert(result[1] instanceof GdkPixbuf.Pixbuf, 'result[1] not instanceof GdkPixbuf.Pixbuf')
    common.assert(result[2] instanceof GdkPixbuf.Pixbuf, 'result[2] not instanceof GdkPixbuf.Pixbuf')
  })
})
