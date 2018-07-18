/*
 * entry.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk')

gi.startLoop()
Gtk.init()


process.on('uncaughtException', (err) => {
  console.log('process.uncaughtException', err)
  process.exit(1)
})
process.on('exit', (code) => {
  console.log('process.exit', code)
})
process.on('SIGINT', () => {
  console.log('process.SIGINT')
  process.exit(2)
})


  // main program window
const window = new Gtk.Window({
  type : Gtk.WindowType.TOPLEVEL
})

// where the URL is written and shown
const entry = new Gtk.Entry()
entry.on('key-press-event', (event) => {
  console.log(event)
  console.log(event.string)
})


// configure main window
window.setDefaultSize(200, 50)
window.setResizable(true)
window.connect('show', () => {
  Gtk.main()
})
window.on('destroy', () => Gtk.mainQuit())
window.on('delete-event', () => false)

window.add(entry)
window.showAll()
