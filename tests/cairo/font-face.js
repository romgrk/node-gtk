/*
 * font-face.js
 */

const gi = require('../../lib/')
const Cairo = gi.require('cairo')
const { describe, it, expect } = require('../__common__.js')

gi.startLoop()

describe('FontFace:', () => {
  it('.status(), .getType(), .getReferenceCount()', () => {
    const font = Cairo.FontFace.create('Arial', Cairo.FontSlant.OBLIQUE, Cairo.FontWeight.BOLD)
    const status = font.status()
    const type = font.getType()
    const rc = font.getReferenceCount()
    expect(status, Cairo.Status.SUCCESS)
    expect(type,   Cairo.FontType.TOY)
    expect(rc > 0, true)
    console.log({ font, status, type, rc })
  })
})

describe('ToyFontFace:', () => {
  it('.create(...)', () => {
    const font = Cairo.FontFace.create('Arial', Cairo.FontSlant.OBLIQUE, Cairo.FontWeight.BOLD)
    console.log(font)
  })

  it('.getFamily(), .getSlant(), .getWeight()', () => {
    const font = Cairo.FontFace.create('Arial', Cairo.FontSlant.OBLIQUE, Cairo.FontWeight.BOLD)
    const family = font.getFamily()
    const slant = font.getSlant()
    const weight = font.getWeight()
    expect(family, 'Arial')
    expect(slant,  Cairo.FontSlant.OBLIQUE)
    expect(weight, Cairo.FontWeight.BOLD)
    console.log({ font, family, slant, weight })
  })
})
