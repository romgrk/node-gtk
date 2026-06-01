/*
 * function_call.js
 */

const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gtk = gi.require('Gtk', '3.0')
const Gst = gi.require('Gst', '1.0')
const { describe, it, mustThrow, expect } = require('./__common__.js')

Gtk.init()
Gst.init();

describe('function arguments', () => {
  it('works', () => {
    // FIXME: find a test case for this with gimarshallingtest
  })

  it('works with null values', () => {
    // FIXME: find a test case for this with gimarshallingtest
  })

  it('works with bigint', () => {
    // When converted to uint64, GST_CLOCK_TIME_NONE > Number.MAX_SAFE_INTEGER
    const GST_CLOCK_TIME_NONE = BigInt.asUintN(/* width */ 64, -1n)

    const elem = Gst.ElementFactory.make('identity', 'iden')

    /*
      typedef guint64 GstClockTime;
      gst_element_set_start_time (GstElement * element,
                                  GstClockTime time);
    */
    elem.setStartTime(GST_CLOCK_TIME_NONE)
  })
})

describe('function call can throw',
  mustThrow(/is not an absolute URI using the/, () => {
    const result = GLib.filenameFromUri('http://google.com')
    console.log('Result:', result)
  }))
