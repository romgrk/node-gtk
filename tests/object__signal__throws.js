/*
 * object__events__throw.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()

const button = new Gtk.Button()

const onClick = (widget, event) => {
    throw new Error('ok')
}

button.on('clicked', onClick)
button.clicked()

let didThrow = false

process.on('exit', (code) => {
    if (code === 0 && !didThrow) {
        console.log('Expected error but got exit code zero')
        process.exit(1)
    }
})
process.on('uncaughtException', (err) => {
  console.log('Caught exception:', err.message)
  console.assert(err.message === 'ok')
  didThrow = true
  process.exit(0)
})
