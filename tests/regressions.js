/*
 * regressions.js
 *
 * This file contains known regressions.
 */

const gi = require('../lib/')
const Gst = gi.require('Gst', '1.0')
const Gtk = gi.require('Gtk', '3.0');
const soup = gi.require('Soup', '2.4')
const Cairo = gi.require('cairo', '1.0')
const { describe } = require('./__common__.js')

Gst.init()
Gtk.init()
gi.startLoop()


/*
 * Window method "inputShapeCombineRegion" dont accept Cairo argument:
 * https://github.com/romgrk/node-gtk/issues/251
 */
describe('CairoRegion identity', () => {
  const win = new Gtk.Window({ title: 'TEST', type : Gtk.WindowType.POPUP })
  win.setDefaultSize(200, 80)
  win.add(new Gtk.Label({ label: 'Hello Gtk+' }))
  const a = new Cairo.Region(new Cairo.RectangleInt(10, 10, 100, 100))

  win.inputShapeCombineRegion(a)
})

describe('soup segfault', () => {
  const input = 'Content-Type;q=1, Accept;q=0.2, X-Custom;q=0.1, Zero;q=0'
  const fn = () => soup.headerParseQualityList(input)
  Array(1000).fill(0).map(fn)
})

describe('GdkRGBA field access', () => {
  const window = new Gtk.Window({ type : Gtk.WindowType.TOPLEVEL })
  window.setDefaultSize(200, 200)
  window.setResizable(true)

  window.on('show', () => {
    setTimeout(run, 500)
    Gtk.main()
  })
  window.on('destroy', () => Gtk.mainQuit())
  window.on('delete-event', () => false)

  window.showAll()

  function run() {
    const color = window.getStyleContext().getBackgroundColor(Gtk.StateFlags.NORMAL)
    console.log(color.red)
    console.log(color.toString())
    Gtk.mainQuit()
  }
})
