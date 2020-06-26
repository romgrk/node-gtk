const gi = require('../lib/')
const GObject = gi.require('GObject', '2.0')
const Gdk = gi.require('Gdk', '3.0')
const { describe, expect, it } = require('./__common__.js')

Gdk.init([])
gi.startLoop()

describe('unpack GValues', () => {
  it('should unpack string', () => {
    const val = new GObject.Value()
    val.init(GObject.TYPE_STRING)
    val.setString('okay')
    expect(val.getString(), 'okay')
  })
  it('should unpack boxed', () => {
    const color0 = new Gdk.RGBA({ red: 0.5, blue: 0.5, green: 0.5, alpha: 0.5 })
    const val = new GObject.Value()
    val.init(GObject.typeFromName('GdkRGBA'))
    val.setBoxed(color0)
    expect(color0.toString(), 'rgba(128,128,128,0.5)')
    const color1 = val.getBoxed()
    expect(color1.toString(), 'rgba(128,128,128,0.5)')
  })
})
