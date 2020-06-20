const gi = require('../lib/')
const GLib = gi.require('GLib', '2.0')
const common = require('./__common__.js')

gi.startLoop()

common.describe('callback value should be set', () => {
  const loop = new GLib.MainLoop(null, false)
  let i = 0
  GLib.idleAdd(GLib.PRIORITY_DEFAULT_IDLE, () => {
    console.log(`count ${i}`)
    if (i++ == 3) {
      loop.quit()
      return false
    }
    return true
  }, loop)

  console.log('Run loop.')
  loop.run()
  console.log('Loop ran.')
  loop.unref()
  common.expect(i, 4)
})
