/*
 * function_call.js
 */

const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gtk = gi.require('Gtk', '3.0')
const { describe, it, mustThrow, expect } = require('./__common__.js')

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
