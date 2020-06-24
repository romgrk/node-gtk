const gi = require('../lib/')
const Gst = gi.require('Gst', '1.0')
const GObject = gi.require('GObject', '2.0')
const { assert, describe, expect, it } = require('./__common__.js')

gi.startLoop()
Gst.init()

function initStructure() {
  const struct = Gst.Structure.newEmpty('name')

  const val0 = new GObject.Value()
  val0.init(GObject.TYPE_STRING)
  val0.setString('okay')
  struct.setValue('msg', val0)

  const val1 = new GObject.Value()
  val1.init(GObject.TYPE_OBJECT)

  const pad = new Gst.Pad()
  val1.setObject(pad)
  struct.setValue('pad', val1)

  return struct
}

describe('return values of type GValue are converted automatically', () => {
  it('should not return a GValue', () => {
    const struct = initStructure()

    const msg = struct.getValue('msg')
    expect(msg, 'okay')
    expect(typeof msg, 'string')

    const pad = struct.getValue('pad')
    assert(pad instanceof Gst.Pad)
    expect(pad.getName(), 'pad0')
  })
})