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

const button = new Gtk.Button()
button.setSizeRequest(100, 50)

window.add(button)
window.setDefaultSize(100, 100)
window.connect('show', () => {
  setTimeout(() => {

    const result = button.getSizeRequest()
    console.log('Result:', result)
    console.assert(result[0] === 100, `result[0] === 100`)
    console.assert(result[1] === 50,  `result[1] === 50`)

    Gtk.main_quit()
  }, 50)
  Gtk.main()
})

window.showAll()
