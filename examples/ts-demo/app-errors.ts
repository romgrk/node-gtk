// PROTOTYPE consumer — this file is EXPECTED TO PRODUCE ERRORS.
// It proves the generated types actually catch mistakes.

import * as gi from 'node-gtk'

const Gtk = gi.require('Gtk', '4.0')

// ERROR: 'labbel' is not a known constructor property.
const button = new Gtk.Button({ labbel: 'typo' })

// ERROR: setLabel expects a string, not a number.
button.setLabel(42)

// ERROR: getLabel() returns string, not number.
const n: number = button.getLabel()

// ERROR: no such enum member.
const bad = Gtk.Orientation.DIAGONAL

// ERROR: a vfunc override must keep the base signature — `virtual_measure`
// returns a 4-number tuple, not a single number.
class BadWidget extends Gtk.Widget {
  static GTypeName = 'TSDemoBadWidget'
  virtual_measure(orientation: number, forSize: number): number {
    return 10
  }
}

export { button, n, bad, BadWidget }
