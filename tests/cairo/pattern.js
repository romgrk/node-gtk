/*
 * pattern.js
 */

const gi = require('../../lib/')
const Cairo = gi.require('cairo')
const { describe, it, expect } = require('../__common__.js')

gi.startLoop()

describe('Pattern:', () => {
  it('.createRgb(...)', () => {
    const pattern = Cairo.Pattern.createRgb(0.5, 0.5, 0.1)
    console.log(pattern)
  })

  it('.createRgba(...)', () => {
    const pattern = Cairo.Pattern.createRgba(0.5, 0.5, 0.1, 0.75)
    console.log(pattern)
  })

  it('.createRadial(...)', () => {
    const pattern = Cairo.Pattern.createRadial(0, 0, 100, 0, 0, 200)
    console.log(pattern)
  })

  it('.createMesh(...)', () => {
    const pattern = Cairo.Pattern.createMesh()
    console.log(pattern)
  })

  it('.createLinear(...)', () => {
    const pattern = Cairo.Pattern.createLinear(0, 0, 100, 100)
    console.log(pattern)
  })

  it('.addColorStopRgb(), .addColorStopRgba(), .getColorStopCount()', () => {
    const pattern = Cairo.Pattern.createLinear(0, 0, 100, 100)
    pattern.addColorStopRgb(0,  1, 0, 0)
    pattern.addColorStopRgba(0, 0, 0, 1, 0.2)
    const count = pattern.getColorStopCount()
    const stop1 = pattern.getColorStopRgba(0)
    const stop2 = pattern.getColorStopRgba(1)
    console.log(stop1)
    console.log(stop2)
    console.log(pattern)
  })

  it('.status()', () => {
    const pattern = Cairo.Pattern.createLinear(0, 0, 100, 100)
    const status = pattern.status()

    console.log(status)
  })

  it('.(get|set)(Extend|Filter)()', () => {
    const pattern = Cairo.Pattern.createLinear(0, 0, 100, 100)
    pattern.setExtend(Cairo.Extend.REPEAT)
    pattern.setFilter(Cairo.Filter.BEST)

    expect(pattern.getExtend(), Cairo.Extend.REPEAT)
    expect(pattern.getFilter(), Cairo.Filter.BEST)
  })
})

describe('LinearPattern:', () => {
  it('.getLinearPoints()', () => {
    const pattern = Cairo.Pattern.createLinear(0, 0, 100, 100)
    pattern.addColorStopRgb(0,  1, 0, 0)
    pattern.addColorStopRgba(0, 0, 0, 1, 0.2)
    const points = pattern.getLinearPoints()
    console.log(points)
    expect(points, { x0: 0, y0: 0, x1: 100, y1: 100 })
  })
})

describe('RadialPattern:', () => {
  it('.getRadialCircles()', () => {
    const pattern = Cairo.Pattern.createRadial(0, 0, 100, 0, 0, 200)
    const circles = pattern.getRadialCircles()
    console.log(circles)
    expect(circles, { x0: 0, y0: 0, r0: 100, x1: 0, y1: 0, r1: 200 })
  })
})
