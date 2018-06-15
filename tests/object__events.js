/*
 * object__events.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init(null, 0)

const window = new Gtk.Window({
  type : Gtk.WindowType.TOPLEVEL
})
const flowBox = new Gtk.FlowBox()
const button = new Gtk.Button()
const urlBar = new Gtk.Entry()

flowBox.add(button)
flowBox.add(urlBar)

window.add(flowBox)

// configure main window
window.setDefaultSize(400, 100)
window.setResizable(true)

window.on('destroy', () => Gtk.main_quit())
window.on('delete_event', () => false)

setTimeout(() => {
  // Run our tests
  let count = 0
  const onClick = (widget, event) => {
      count++
  }

  button.on('clicked', onClick)
  button.clicked()
  if (count !== 1) {
      console.error('Expected count to be equal to 1 (after .on)')
      Gtk.main_quit()
      process.exit(1)
  }

  button.off('clicked', onClick)
  button.clicked()
  if (count !== 1) {
      console.error('Expected count to be equal to 1 (after .off)')
      Gtk.main_quit()
      process.exit(1)
  }

  button.once('clicked', onClick)
  button.clicked()
  button.clicked()
  if (count !== 2) {
      console.error('Expected count to be equal to 2 (after .once)')
      Gtk.main_quit()
      process.exit(1)
  }

  Gtk.main_quit()
  process.exit(0)

}, 100)

Gtk.main()
