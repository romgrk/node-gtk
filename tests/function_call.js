/*
 * function_call.js
 */

const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gst = gi.require('Gst', '1.0')
const Gtk = gi.require('Gtk', '3.0')
const { describe, it, mustThrow, expect } = require('./__common__.js')

Gst.init()
Gtk.init()

describe('function arguments', () => {
  it('works', () => {
    // FIXME: find a test case for this with gimarshallingtest
  })

  it('works with null values', () => {
    // FIXME: find a test case for this with gimarshallingtest
  })
})

describe('function call can throw',
  mustThrow(/is not an absolute URI using the/, () => {
    const result = GLib.filenameFromUri('http://google.com')
    console.log('Result:', result)
  }))

describe('transfer-full function argument', () => {
  it("doesn't invalidate js wrapper -- boxed", () => {
    let gstPromise = new Gst.Promise();
    let structure = Gst.Structure.newEmpty('test');

    /*
     * https://gstreamer.freedesktop.org/documentation/gstreamer/gstpromise.html?gi-language=c#gst_promise_reply
     *
     * Parameters:
     *   <...>
     *   s ( [transfer: full][nullable]) – a GstStructure with the the reply contents 
    */
    gstPromise.reply(structure);

    // GstPromise will take the structure with it.
    gstPromise = null;
    // Required, to actually take gstPromise down.
    global.gc();

    // Gst will issue an assertion and return false if structure's
    // backing object is destroyed.
    expect(structure.isEqual(structure), true);
  });
})
