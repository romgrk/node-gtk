/*
 * function_call__out.js
 */


const gi = require('../lib/')

const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init(null, 0)

const window = new Gtk.Window({
  type : Gtk.WindowType.TOPLEVEL
})

// configure main window
window.setDefaultSize(400, 100)
window.connect('show', () => {
  setTimeout(() => {
    const result = window.getSizeRequest()
    console.log(typeof result, result)
    Gtk.main_quit()
  }, 50)
  Gtk.main()
})

window.showAll()
