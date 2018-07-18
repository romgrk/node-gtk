/*
 * signal__error.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()


// Setup

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


// Run test

const button = new Gtk.Button()
button.on('clicked', () => {
    throw new Error('ok')
})
button.clicked()
