/*
 * scaled-font.js
 */

const gi = require('../../lib/')
const Cairo = gi.require('cairo')
const { describe, it, expect } = require('../__common__.js')

gi.startLoop()

describe('ScaledFont:', () => {
  const text = 'Hello'

  let scaledFont

  it('.create(...)', () => {
    const font = Cairo.FontFace.create('Arial', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD)
    const fontMatrix = new Cairo.Matrix()
    const ctm = new Cairo.Matrix()
    const options = new Cairo.FontOptions()
    scaledFont = Cairo.ScaledFont.create(font, fontMatrix, ctm, options)
  })

  it('.textToGlyphs()', () => {
    const [glyphs, clusters] = scaledFont.textToGlyphs(0, 0, text, true)
    expect(glyphs.length,   text.length)
    expect(clusters.length, text.length)
  })

  it('.extents()', () => {
    const extents = scaledFont.extents()
    console.log({ extents })
  })

  it('.textExtents()', () => {
    const textExtents = scaledFont.textExtents(text)
    console.log({ textExtents })
  })

  it('.glyphExtents()', () => {
    const [glyphs] = scaledFont.textToGlyphs(0, 0, text)
    const glyphExtents = scaledFont.glyphExtents(glyphs)
    console.log({ glyphExtents })
  })

  it('.getXxxxx()', () => {
    const font    = scaledFont.getFontFace()
    expect(font !== undefined, true)
    const options = scaledFont.getFontOptions()
    expect(options !== undefined, true)
    const matrix  = scaledFont.getFontMatrix()
    expect(matrix !== undefined, true)
    const ctm     = scaledFont.getCtm()
    expect(ctm !== undefined, true)
    const scale   = scaledFont.getScaleMatrix()
    expect(scale !== undefined, true)
    const type    = scaledFont.getType() // from doc: this function never returns CAIRO_FONT_TYPE_TOY
    expect(type !== 0, true)
    const rc = scaledFont.getReferenceCount()
    expect(rc > 0, true)
  })
})
