/*
 * keybinder.mjs
 *
 * Run with:  node --import node-gtk/register examples/keybinder.mjs
 */

import Gtk from 'gi:Gtk-3.0'
import Keybinder from 'gi:Keybinder-3.0'

function callback(keystring) {
  console.log("In callback for", keystring)
  console.log("Event time:", Keybinder.getCurrentEventTime())
  Keybinder.unbind(keystring)
  Gtk.mainQuit()
}

Gtk.init()
Keybinder.init()
Keybinder.bind("<Control>A", callback)
console.log("Press <Control>A to activate keybinding and quit");
Gtk.main()
