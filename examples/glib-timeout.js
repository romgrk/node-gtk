/*
 * callback.js
 */

const gi = require('../')
const GLib = gi.require('GLib', '2.0')

gi.startLoop()

const loop = new GLib.MainLoop(null, false)
let i = 0

GLib.timeoutAddSeconds(0, 1, () => {
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
