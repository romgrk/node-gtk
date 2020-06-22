const gi = require('../lib/')
const Gst = gi.require('Gst')
const common = require('./__common__.js')
gi.startLoop()
Gst.init()

common.describe('callback should be called from another thread', async () => {
  return await new Promise((resolve, reject) => {
    const pipeline = new Gst.Pipeline()
    const webrtcbin = Gst.ElementFactory.make('webrtcbin')
  
    if (!pipeline || !webrtcbin) {
      throw new Error('Could not create all elements.')
    }
    pipeline.add(webrtcbin)
  
    pipeline.setState(Gst.State.PLAYING)
  
    const timeout = setTimeout(() => {
      reject()
    }, 500)
    const s = Gst.Structure.newEmpty('structure')
    const p = Gst.Promise.newWithChangeFunc(() => {
      resolve()
      clearTimeout(timeout)
    })
    webrtcbin.emit('create-offer', s, p)
  })
})
