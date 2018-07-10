/*
 * interface__caching.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()

console.assert(
  Gtk.Entry.prototype.insertText === Gtk.SearchEntry.prototype.insertText,
  'Interface methods not cached'
)
