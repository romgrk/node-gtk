/*
 * surface.js
 */


const gi = require('../../lib/')
const Cairo = gi.require('cairo')
const { describe, it, expect } = require('../__common__.js')

gi.startLoop()

describe('Surface:', () => {
  it('works', () => {
    const surface = new Cairo.ImageSurface(
      Cairo.Format.RGB24, 400, 300)
    const status = surface.status()
    expect(status, Cairo.Status.SUCCESS)
    surface.flush()
    expect(surface.getReferenceCount(), 1)
    console.log(surface.getFallbackResolution())
    expect(typeof surface.hasShowTextGlyphs(), 'boolean')
    expect(surface.getWidth(), 400)
    expect(surface.getHeight(), 300)
    expect(surface.getFormat(), Cairo.Format.RGB24)
  })
})
