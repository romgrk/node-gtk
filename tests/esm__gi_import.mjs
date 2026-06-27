/*
 * esm__gi_import.mjs
 *
 * `import Gtk from 'gi:Gtk-4.0'` must yield the namespace object (the default
 * export of the synthetic `gi:` module). Run as a child of esm__gi_import.js with
 * the gi: hooks installed via `node --import .../register.mjs`. Exits 0 on
 * success, 222 to skip (typelib unavailable).
 */

// GLib is the foundational namespace and is always present where node-gtk runs,
// so the static-import form is safe to exercise unconditionally.
import GLib from 'gi:GLib-2.0'

if (typeof GLib?.MainLoop !== 'function') {
  console.error('FAIL: gi:GLib-2.0 default export is not a namespace object:', GLib)
  process.exit(1)
}

// Gtk may be absent in some headless/CI setups -> skip rather than fail.
let Gtk
try {
  Gtk = (await import('gi:Gtk-4.0')).default
} catch (e) {
  console.error('skip: Gtk-4.0 unavailable:', e.message)
  process.exit(222)
}

if (typeof Gtk.Box !== 'function') {
  console.error('FAIL: gi:Gtk-4.0 default export is not a namespace object')
  process.exit(1)
}

console.log('OK: gi: ESM default import works')
