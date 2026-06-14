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

export { button, n, bad }
