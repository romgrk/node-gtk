const gi = require('../lib')
const Gst = gi.require('Gst', '1.0')
const GObject = gi.require('GObject', '2.0')
const { assert, describe, expect, it } = require('./__common__.js')

gi.startLoop()
Gst.init()

describe('create introspected objected', () => {
  const bin = new Gst.Bin('name')
  expect(bin.constructor.name, 'GstBin')
  expect(typeof bin.add, 'function')

  it('is instance of all parent classes', () => {
    assert(bin instanceof Gst.Bin)
    assert(bin instanceof Gst.Element)
    assert(bin instanceof Gst.Object)
    assert(bin instanceof GObject.InitiallyUnowned)
    assert(bin instanceof GObject.Object)
  })
})

describe('create non-introspected objected', () => {
  const src = Gst.ElementFactory.make('videotestsrc')
  expect(src.constructor.name, 'GstVideoTestSrc')
  expect(typeof src.addPad, 'function')

  it('is instance of all (introspected) parent classes', () => {
    assert(src instanceof Gst.Element)
    assert(src instanceof Gst.Object)
    assert(src instanceof GObject.InitiallyUnowned)
    assert(src instanceof GObject.Object)
  })
})
