const gi = require('../lib/')
const GLib = gi.require('GLib', '2.0')
const Gio = gi.require('Gio', '2.0')
const common = require('./__common__.js')

gi.startLoop()

common.describe('callback should be called from another thread', async () => {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject('timeout')
    }, 1000)
    const task = new Gio.Task(null)
    task.runInThread(() => {
      clearTimeout(timeout)
      resolve()
    })
  })
})
