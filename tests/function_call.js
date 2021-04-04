/*
 * function_call.js
 */

const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gtk = gi.require('Gtk', '3.0')
const Vte = gi.require('Vte', '2.91');
const { describe, it, mustThrow, expect } = require('./__common__.js')

Gtk.init()

describe('function arguments', () => {
  it('works', () => {
    // FIXME: find a test case for this with gimarshallingtest
  })

  it('works with null values', () => {
    let childSetup = null

    const terminal = new Vte.Terminal();
    terminal.spawnSync(
      Vte.PtyFlags.DEFAULT,
      GLib.getHomeDir(),
      ['bash'],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      childSetup,
      null
    )
  })
})

describe('function call can throw',
  mustThrow(/is not an absolute URI using the/, () => {
    const result = GLib.filenameFromUri('http://google.com')
    console.log('Result:', result)
  }))
