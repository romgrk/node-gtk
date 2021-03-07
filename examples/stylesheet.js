/*
 * stylesheet.js
 */

const gi = require('../')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
// gi.require('GdkX11', '3.0') // Required if you're on X11

Gdk.init([])
Gtk.init()

const display = Gdk.Display.getDefault()
const screen = display.getDefaultScreen()
const css = new Gtk.CssProvider()
css.loadFromPath(__dirname + '/style.css')
Gtk.StyleContext.addProviderForScreen(screen, css, 1)
