/*
 * pango-cairo.mjs
 *
 * Run with:  node --import node-gtk/register examples/pango-cairo.mjs
 */

import { startLoop } from 'node-gtk'
import Gtk from 'gi:Gtk-3.0'
import Cairo from 'gi:cairo'
import Pango from 'gi:Pango'
import PangoCairo from 'gi:PangoCairo'

startLoop()
Gtk.init()

const surface = new Cairo.ImageSurface(Cairo.Format.RGB24, 300, 300)
const cr = new Cairo.Context(surface)
const fd = Pango.fontDescriptionFromString('Fantasque Sans Mono 16')
const layout = PangoCairo.createLayout(cr)
layout.setFontDescription(fd)
layout.setAlignment(Pango.Alignment.LEFT)
layout.setMarkup('<span font_weight="bold">A</span>')
const [boldWidth, boldHeight] = layout.getSize()
layout.setMarkup('<span>A</span>')
const pixels = layout.getPixelSize()
const [normalWidth, normalHeight] = layout.getSize()

console.log({ fd, pixels, normalWidth, boldWidth })
