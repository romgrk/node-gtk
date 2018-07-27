/*
 * signal.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const common = require('./__common__.js')

gi.startLoop()
Gtk.init()

const window = new Gtk.Window({
  type : Gtk.WindowType.TOPLEVEL
})
const hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
const button = new Gtk.Button()
const urlBar = new Gtk.Entry()

hbox.packStart(button, false, false, 0)
hbox.packStart(urlBar, true,  true,  0)

window.add(hbox)

// configure main window
window.setDefaultSize(400, 100)
window.setResizable(true)

window.on('destroy', () => Gtk.mainQuit())
window.on('delete-event', () => false)
window.on('show', () => {
  // Run our tests
  let count = 0
  const onClick = (widget, event) => {
      count++
  }

  button.on('clicked', onClick)
  button.clicked()
  if (count !== 1) {
      console.error('Expected count to be equal to 1 (after .on)')
      process.exit(1)
  }

  button.off('clicked', onClick)
  button.clicked()
  if (count !== 1) {
      console.error('Expected count to be equal to 1 (after .off)')
      process.exit(1)
  }

  button.once('clicked', onClick)
  button.clicked()
  button.clicked()
  if (count !== 2) {
      console.error('Expected count to be equal to 2 (after .once)')
      process.exit(1)
  }

  console.log('Done')
  process.exit(0)
})

window.showAll()
Gtk.main()
