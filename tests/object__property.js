/*
 * object_get.js
 */

const gi = require('../lib')
const Gtk = gi.require('Gtk', '3.0')
Gtk.init()

const win = new Gtk.Window()

console.log('win.title:', win.title)

if (win.title === undefined)
    process.exit(1)

win.title = 'New Title'
console.log('win.title:', win.title)

if (win.title !== 'New Title')
    process.exit(1)
