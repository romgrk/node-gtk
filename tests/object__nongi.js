const gi = require('../lib')
const Gst = gi.require('Gst', '1.0')
const { expect } = require('./__common__.js')

gi.startLoop()
Gst.init()

const bin = new Gst.Bin('name')
expect(bin.constructor.name, 'GstBin')
expect(typeof bin.add, 'function')
console.log(bin.numchildren)

const src = Gst.ElementFactory.make('videotestsrc')
expect(src.constructor.name, 'GstVideoTestSrc')
expect(typeof src.addPad, 'function')