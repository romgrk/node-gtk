const gi = require('../lib/')
const GLib = gi.require('GLib', '2.0')
const Gio = gi.require('Gio', '2.0')
const Gst = gi.require('Gst', '1.0')
const common = require('./__common__.js')

Gst.init()
gi.startLoop()

common.describe('callback value is set', () => {
  const loop = new GLib.MainLoop(null, false)
  let i = 0
  GLib.timeoutAdd(GLib.PRIORITY_HIGH, 0, () => {
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

common.describe('callback run from another thread spawned from GTask', async () => {
  await new Promise((resolve, reject) => {
    const task = new Gio.Task(null)
    if (!task.runInThread) {
      console.warn('g_task_run_in_thread is not available')
      return resolve()
    }
    const timeout = setTimeout(() => {
      reject('timeout')
    }, 1000)
    task.runInThread(() => {
      clearTimeout(timeout)
      resolve()
    })
  })
})

common.describe('callback run from another thread spawned from GstPipeline', async () => {
  return await new Promise((resolve, reject) => {
    const pipeline = new Gst.Pipeline()
    const webrtcbin = Gst.ElementFactory.make('webrtcbin')

    if (!pipeline || !webrtcbin) {
      reject('Could not create all elements.')
    }
    pipeline.add(webrtcbin)

    pipeline.setState(Gst.State.PLAYING)

    const timeout = setTimeout(() => {
      reject()
    }, 1000)
    const s = Gst.Structure.newEmpty('structure')
    const p = Gst.Promise.newWithChangeFunc(() => {
      resolve()
      clearTimeout(timeout)
    })
    webrtcbin.emit('create-offer', s, p)
  })
})
