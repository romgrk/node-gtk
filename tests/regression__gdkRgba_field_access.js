/*
 * regression__gdkRgba_field_access.js
 */


const gi = require('../');
const Gtk = gi.require('Gtk', '3.0');
const Pango = gi.require('Pango');
const common = require('./__common__.js')

gi.startLoop()
Gtk.init()


// common.skip()

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
  process.exit(0)
}
