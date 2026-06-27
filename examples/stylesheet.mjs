/*
 * stylesheet.mjs
 *
 * Run with:  node --import node-gtk/register examples/stylesheet.mjs
 */

import Gtk from 'gi:Gtk-3.0'
import Gdk from 'gi:Gdk-3.0'
// import GdkX11 from 'gi:GdkX11-3.0' // Required if you're on X11
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

Gdk.init([])
Gtk.init()

const display = Gdk.Display.getDefault()
const screen = display.getDefaultScreen()
const css = new Gtk.CssProvider()
css.loadFromPath(__dirname + '/style.css')
Gtk.StyleContext.addProviderForScreen(screen, css, 1)
