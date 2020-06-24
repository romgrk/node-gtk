const gi = require('../lib/')
const Gst = gi.require('Gst', '1.0')
const GObject = gi.require('GObject', '2.0')
const { describe, expect, it } = require('./__common__.js')

gi.startLoop()
Gst.init()

function initStructure() {
  const struct = Gst.Structure.newEmpty('name')

  // initialize GValue of type G_TYPE_STRING
  const val0 = new GObject.Value()
  val0.init(16 << 2)
  val0.setString('okay')
  struct.setValue('key', val0)

  return struct
}

describe('return values of type GValue are converted automatically', () => {
  it('should not return a GValue', () => {
    const struct = initStructure()

    const msg = struct.getValue('key')
    expect(msg, 'okay')
    expect(typeof msg, 'string')
  })
})