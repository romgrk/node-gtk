/*
 * preload.js
 */

global.gi = require('../')
global.gtk = gi.require('Gtk', '3.0')
global.gdk = gi.require('Gdk', '3.0')

gtk.init([])
gdk.init([])
