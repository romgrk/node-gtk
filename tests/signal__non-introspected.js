/*
 * signal.js
 */


const gi = require('../lib/')
const Gst = gi.require('Gst', '1.0')
const { describe, it, mustThrow, assert, expect } = require('./__common__.js')

gi.startLoop()
Gst.init()

describe('signal handlers are available for non-introspected objects', async () => {
  return new Promise((resolve, reject) => {
    // Create pipeline
    const pipeline = new Gst.Pipeline()
    const src = Gst.ElementFactory.make('videotestsrc')
    const typefind = Gst.ElementFactory.make('typefind')
    if (!pipeline || !src || !typefind) {
      reject('Not all elements could be created.')
      return
    }
    pipeline.add(src)
    pipeline.add(typefind)
  
    // Link elements
    if (!src.link(typefind)) {
      pipeline.unref()
      reject('Elements could not be linked.')
      return
    }
  
    typefind.once('have-type', (probability, caps) => {
      expect(probability, 100);
      assert(caps instanceof Gst.Caps)
      clearTimeout(timeout)
      pipeline.unref()
      resolve()
    })

    it('should throw when signal name is invalid', mustThrow('Signal name is invalid', () => {
      typefind.once('has-type', () => {})
    }))
  
    const ret = pipeline.setState(Gst.State.PLAYING)
    if (ret === Gst.State.CHANGE_FAILURE) {
      pipeline.unref()
      reject('Unable to set the pipeline to the playing state.')
      return
    }
  
    // keep alive
    const timeout = setTimeout(() => {
      reject('timeout')
    }, 1000)
  })
})
