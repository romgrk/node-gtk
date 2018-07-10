/*
 * entry.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk')

gi.startLoop()
Gtk.init()

  // main program window
const window = new Gtk.Window({
  type : Gtk.WindowType.TOPLEVEL
})

// where the URL is written and shown
const entry = new Gtk.Entry()
entry.on('key-press-event', (event) => {
  console.log(event)
  console.log(event.string)
  console.log('')

  console.log(event, Object.keys(event))
  console.log(event.__proto__, Object.keys(event.__proto__))

  const e = new Gdk.EventKey()
  console.log(e, Object.keys(e))
  console.log(e.__proto__, Object.keys(e.__proto__))

  console.log(e.__proto__ === event.__proto__)
  console.log(e.__proto__.__proto__ === event.__proto__.__proto__)
})


// configure main window
window.setDefaultSize(200, 50)
window.setResizable(true)
window.connect('show', () => {
  // bring it on top in OSX
  // window.setKeepAbove(true)
  Gtk.main()
})
window.on('destroy', () => Gtk.mainQuit())
window.on('delete-event', () => false)

window.add(entry)
window.showAll()
