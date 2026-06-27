// PROTOTYPE consumer — this file is EXPECTED TO TYPECHECK CLEANLY.
// It demonstrates the IntelliSense / checking a node-gtk user gets, using the
// `gi:` import form (the generated shim types each `gi:<Namespace>-<version>`).

import Gtk from 'gi:Gtk-4.0'    // typed as the Gtk-4.0 namespace
import GLib from 'gi:GLib-2.0'

Gtk.init()

// Constructor property bags are typed (camelCase, node-gtk #320).
const win = new Gtk.ApplicationWindow({ title: 'Hello', defaultWidth: 400 })

// Methods are camelCase and return-typed.
const button = new Gtk.Button({ label: 'Click me' })
button.setLabel('Press')
const current: string | null = button.getLabel()   // getLabel(): string | null (GI nullability)

// Signals: typed overloads, instance is NOT the first callback arg (node-gtk #21).
button.on('clicked', () => {
  console.log('clicked!')
})

// Enums resolve to real enum members.
const orientation = Gtk.Orientation.VERTICAL
const box = new Gtk.Box({ orientation, spacing: 6 })
box.append(button)
win.setChild(box)

// Cross-namespace types flow through (GLib here).
const ctx = GLib.MainContext.default()

win.on('close-request', () => false)
win.present()

export { win, button, current, ctx }
