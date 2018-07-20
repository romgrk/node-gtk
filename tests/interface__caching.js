/*
 * interface__caching.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const common = require('./__common__.js')

gi.startLoop()
Gtk.init()

common.assert(
  Gtk.Entry.prototype.insertText === Gtk.SearchEntry.prototype.insertText,
  'Interface methods not cached'
)
