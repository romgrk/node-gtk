/*
 * pango-cairo.js
 */

const gi = require('../')
const Gtk = gi.require('Gtk', '3.0')
const Cairo = gi.require('cairo')
const Pango = gi.require('Pango')
const PangoCairo = gi.require('PangoCairo')

gi.startLoop()
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
