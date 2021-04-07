/*
 * preinspect.js
 *
 * This script is used to explore available libraries. Use it by calling
 * `node -r ./scripts/preinspect.js`, then you can filter `i.infos` at your
 * convenience.
 */

global.i = require('../lib/inspect')
global.gtk = i.parseNamespace('Gtk', '4.0')
global.gdk = i.parseNamespace('Gdk', '4.0')
global.glib = i.parseNamespace('GLib', '2.0')
global.go = i.parseNamespace('GObject', '2.0')

// Example: find all inout arguments
// as = i.infos.filter(i => i.infoType === 'arg' && i.direction === 'INOUT')
