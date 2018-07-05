/*
 * interface.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()

const window = new Gtk.Window({ type : Gtk.WindowType.TOPLEVEL })
const entry = new Gtk.Entry()

window.add(entry)

// configure main window
window.setDefaultSize(400, 50)
window.setResizable(true)
window.on('destroy', () => { Gtk.mainQuit() })
window.on('delete_event', () => { Gtk.mainQuit() })
window.on('show', () => {

  const text = 'some text'

  {
    const result = entry.insertText(text, text.length, 0)
    console.log('Result:', result)
    console.assert(result === 9)
  }

  {
    const result = entry.getChars(0, -1)
    console.log('Result:', result)
    console.assert(result === text)
  }

  {
    const result = entry.getPosition()
    console.log('Result:', result)
    console.assert(result === 0)
  }

  {
    const result = entry.editingCanceled
    console.log('Result:', result)
    console.assert(result !== undefined)
  }

  {
    const result = entry.editingDone()
    console.log('Result:', result)
  }

  process.exit(0)
})

window.showAll()
