/*
 * object__subclass.js
 */

const gi = require('../')
const common = require('./__common__.js')

const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')

gi.startLoop()
Gtk.init()
Gdk.init([])

/*
 * This test makes sure that a non-introspected subclass object can
 * be used as a base class object.
 *
 * In this case, `Gdk.Display.getDefault()` returns a GdkX11Screen from the
 * not-loaded "GdkX11" module, and is used as a GdkScreen.
 */

const display = Gdk.Display.getDefault()
const screen = display.getDefaultScreen()

const css = new Gtk.CssProvider()
css.loadFromData(`
  button {
    padding: 20px;
  }
`)

Gtk.StyleContext.addProviderForScreen(screen, css, 600)
