/*
 * region.js
 */


const gi = require('../../lib/')
const Cairo = gi.require('cairo')
const { describe, it, expect } = require('../__common__.js')

gi.startLoop()

describe('Region:', () => {
  it('new Region()', () => {
    const region = new Cairo.Region(new Cairo.RectangleInt(10, 10, 100, 100))
  })

  it('.copy(other)', () => {
    let region = new Cairo.Region(new Cairo.RectangleInt(10, 10, 100, 100))
    let other = Cairo.Region.copy(region)
    console.log(other)
  })

  it('other instance methods', () => {
    let a  = new Cairo.Region(new Cairo.RectangleInt(10, 10, 100, 100))
    let aa = new Cairo.Region(new Cairo.RectangleInt(10, 10, 100, 100))
    let b  = new Cairo.Region(new Cairo.RectangleInt(10, 50, 100, 100))

    let rect = new Cairo.RectangleInt(20, 20, 50, 50)

    let extents = a.getExtents()
    console.log(extents)

    let isEmpty = a.isEmpty()
    console.log({ isEmpty })
    expect(isEmpty, false)

    expect(a.containsPoint(2,  2),  false)
    expect(a.containsPoint(15, 15), true)

    expect(a.containsRectangle(rect), Cairo.RegionOverlap.IN)

    expect(a.equal(aa), true)
    expect(a.equal(b),  false)

    b.translate(10, 10)
    b.intersect(a)
    aa.subtract(a)
    b.union(aa)
    b.xor(a)
  })

})
