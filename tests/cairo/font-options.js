/*
 * font-options.js
 */


const gi = require('../../lib/')
const Cairo = gi.require('cairo')
const { describe, it, expect } = require('../__common__.js')

gi.startLoop()

describe('FontOptions:', () => {
  it('new FontOptions()', () => {
    const options = new Cairo.FontOptions()
  })

  it('new FontOptions(other)', () => {
    const options = new Cairo.FontOptions(new Cairo.FontOptions())
  })

  it('other instance methods', () => {
    const options = new Cairo.FontOptions()
    const other = new Cairo.FontOptions()

    other.setAntialias(Cairo.Antialias.SUBPIXEL)
    other.setSubpixelOrder(Cairo.SubpixelOrder.RGB)
    other.setHintStyle(Cairo.HintStyle.MEDIUM)
    other.setHintMetrics(Cairo.HintMetrics.ON)
    other.setVariations('wght=200,wdth=140.5')

    options.merge(other)

    expect(options.getAntialias(), Cairo.Antialias.SUBPIXEL)
    expect(options.getSubpixelOrder(), Cairo.SubpixelOrder.RGB)
    expect(options.getHintStyle(), Cairo.HintStyle.MEDIUM)
    expect(options.getHintMetrics(), Cairo.HintMetrics.ON)
    expect(options.getVariations(), 'wght=200,wdth=140.5')

    console.log({
      status: options.status(),
      hash: options.hash(),
    })
  })

})
