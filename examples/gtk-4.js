/*
 * gtk4.js
 */

const gi = require('..')
const GLib = gi.require('GLib', '2.0')
const Gtk = gi.require('Gtk', '4.0')

gi.startLoop()

const printHello = () => console.log('Hello')

const loop = GLib.MainLoop.new(null, false)

const app = new Gtk.Application('com.github.romgrk.node-gtk.demo', 0)
app.on('activate', onActivate)

const status = app.run([])

console.log('Finished with status:', status)

function onQuit() {
  loop.quit()
  return false
}

function onActivate() {
  const window = new Gtk.ApplicationWindow(app)
  window.setTitle('Window')
  window.setDefaultSize(200, 200)
  window.on('close-request', onQuit)

  const button = Gtk.Button.newWithLabel('Hello World')
  button.on('clicked', printHello)

  window.setChild(button)
  window.show()
  window.present()

  loop.run()
}
