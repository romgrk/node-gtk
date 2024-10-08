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
const vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
const button = new Gtk.Button()
const input = new Gtk.Entry()

vbox.add(button)
vbox.add(input)
window.add(vbox)

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

  describe('fails with invalid signal name',
    mustThrow(/Signal name is invalid/, () => {
      button.on('INVALID_SIGNAL_NAME', onClick)
    }))

  describe('.emit()', () => {
    it('works', () => {
      const [success, signalId] = GObject.signalParseName('clicked', button.__gtype__, false)

      const result = button.emit('can-activate-accel', signalId)
      assert(result, 'Couldn\'t emit "can-activate-accel" signal on GtkButton')
    })

    it('works with interface types', () => {
      const event = new Gdk.EventKey()
      const result = button.emit('key-press-event', event)
      console.log(result)
      assert(
        typeof result === 'boolean',
        'Couldn\'t emit "key-press-event" signal on GtkButton'
      )
    })

    it('fails when missing arguments', mustThrow(/Not enough arguments/, () => {
      const result = button.emit('can-activate-accel')
    }))

    it('fails with incorrect argument types',
      mustThrow(/Cannot convert value.*to type GdkEvent/, () => {
        button.emit('key-press-event', 42)
      })
    )
  })

  describe('Trigger "on-focus-out-event" should work', async () => new Promise((resolve, reject) => {
    const searchEntry = new Gtk.SearchEntry();
    const event = new Gdk.EventFocus()
    event.type = Gdk.EventType.FOCUS_CHANGE
    event.window = searchEntry.getWindow()
    event.sendEvent = 1

    searchEntry.on('focus-out-event', (event) => resolve())
    searchEntry.emit('focus-out-event', event);
    // In case resolve is never called, do not block test indefinitely
    setTimeout(() => reject(), 1000);
  }));

  describe('types are as correct as possible', () => {
    const event = new Gdk.EventButton()
    event.type = Gdk.EventType.BUTTON_PRESS
    event.window = button.getWindow()
    event.sendEvent = 1
    event.time = 0
    event.x = 10
    event.y = 10
    event.button = 3

    button.on('button-press-event', (event) => {
      expect(event.button, 3)
      return Gtk.EVENT_CONTINUE
    })

    const result = button.emit('button-press-event', event)

    console.log(result)
    assert(
      typeof result === 'boolean',
      'Couldn\'t emit "button-press-event" signal on GtkButton'
    )
  })

  window.close()
})

window.showAll()
Gtk.main()
