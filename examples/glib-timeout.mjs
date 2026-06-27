/*
 * glib-timeout.mjs
 *
 * Run with:  node --import node-gtk/register examples/glib-timeout.mjs
 */

import GLib from 'gi:GLib-2.0'

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
// Note: don't call loop.unref() here. node-gtk's wrapper owns the MainLoop's
// reference and releases it when the wrapper is garbage-collected; an explicit
// unref() drops it a second time, which double-frees the loop and crashes at
// process exit when the loop integration is active (#429).
