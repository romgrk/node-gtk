/*
 * conversion__int8_char.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')

const { it } = require('./__common__.js')

gi.startLoop()
Gtk.init()
Gdk.init([])

const style = `
button {
  padding: 20px;
}
`

const buffer = Buffer.from(style)

console.log({ content: buffer.toString() })

it('converts JS String to char* automatically', () => {
  const css = new Gtk.CssProvider()
  css.loadFromData(style)
})

it('converts Node Buffer to char* automatically', () => {
  const css = new Gtk.CssProvider()
  css.loadFromData(buffer)
})
