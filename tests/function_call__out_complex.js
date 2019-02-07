/*
 * function_call__out_complex.js
 */


const gi = require('../lib/')
const Cairo = gi.require('cairo')
const Pango = gi.require('Pango')
const PangoCairo = gi.require('PangoCairo')
const common = require('./__common__.js')


const fontDescription = Pango.fontDescriptionFromString('monospace 12px')

const cairoSurface = new Cairo.ImageSurface(Cairo.Format.RGB24,
                                            300,
                                            300)
const cairoContext = new Cairo.Context(cairoSurface)

const pangoLayout = PangoCairo.createLayout(cairoContext)
pangoLayout.setAlignment(Pango.Alignment.LEFT)
pangoLayout.setFontDescription(fontDescription)
pangoLayout.setMarkup('<span>A</span><span>⨯</span>')


const result = pangoLayout.getPixelExtents()
common.assert(result.length === 2, 'Expected 2 out arguments, got ' + result.length)

const [inkRect, logicalRect] = result
common.assert(result.length === 2, 'Expected 2 out arguments, got ' + result.length)
common.assert(inkRect instanceof Pango.Rectangle, 'Expected inkRect to be instanceof PangoRectangle')
common.assert(logicalRect instanceof Pango.Rectangle, 'Expected logicalRect to be instanceof PangoRectangle')
common.assert(typeof inkRect.width === 'number' && inkRect.width > 0, 'Unexpected result for inkRect.width: ' + inkRect.width)
common.assert(typeof logicalRect.width === 'number' && logicalRect.width > 0, 'Unexpected result for logicalRect.width: ' + logicalRect.width)
