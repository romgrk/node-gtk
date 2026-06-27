// PROTOTYPE consumer — this file is EXPECTED TO TYPECHECK CLEANLY.
// It demonstrates the IntelliSense / checking a node-gtk user gets, using the
// `gi:` import form (the generated shim types each `gi:<Namespace>-<version>`).

import Gtk from 'gi:Gtk-4.0'    // typed as the Gtk-4.0 namespace
import GLib from 'gi:GLib-2.0'
import { registerClass } from 'node-gtk'

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

// Virtual-function overrides: define `virtual_<name>` to override a vfunc.
// node-gtk wires these into the GObject vtable via registerClass(); the
// override signature is type-checked against the emitted vfunc declaration
// (out-params folded into the return tuple) and `super.virtual_<name>()` resolves.
class CustomWidget extends Gtk.Widget {
  static GTypeName = 'TSDemoCustomWidget'
  virtual_measure(orientation: number, forSize: number): [number, number, number, number] {
    const size = orientation === Gtk.Orientation.HORIZONTAL ? 100 : 40
    return [size, size, -1, -1]
  }
}
registerClass(CustomWidget)
const custom = new CustomWidget()

win.on('close-request', () => false)
win.present()

export { win, button, current, ctx, custom }
