/*
 * signal.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GObject = gi.require('GObject')
const { describe, it, mustThrow, assert, expect } = require('./__common__.js')

gi.startLoop()
Gtk.init()
Gdk.init([])

const window = new Gtk.Window({ type: Gtk.WindowType.TOPLEVEL })
const button = new Gtk.Button()

window.add(button)

// configure main window
window.setDefaultSize(400, 100)
window.setResizable(true)

window.on('destroy', Gtk.mainQuit)
window.on('delete-event', () => false)
window.on('show', () => {
  // Run our tests
  let count = 0
  const onClick = () => { count++ }

  describe('.on() works', () => {
    button.on('clicked', onClick)
    button.clicked()
    expect(count, 1)
  })

  describe('.off() works', () => {
    button.off('clicked', onClick)
    button.clicked()
    expect(count, 1)
  })

  describe('.once() works', () => {
    button.once('clicked', onClick)
    button.clicked()
    button.clicked()
    expect(count, 2)
  })

  describe('.emit()', () => {
    it('works', () => {
      const [success, signalId] = GObject.signalParseName('clicked', button.__gtype__, false)

      const result = button.emit('can-activate-accel', signalId)
      assert(result, 'Couldn\'t emit "can-activate-accel" signal on GtkButton')
    })

    it('fails when missing arguments', mustThrow(/Not enough arguments/, () => {
      const result = button.emit('can-activate-accel')
    }))

    it('fails with incorrect argument types', () => {
      const event = new Gdk.EventKey()
      console.log(event)
      const result = button.emit('key-press-event', event)
      assert(result, 'Couldn\'t emit "can-activate-accel" signal on GtkButton')
    })
  })

  window.close()
})

window.showAll()
Gtk.main()
