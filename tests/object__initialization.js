/*
 * object__initialization.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const GLib = gi.require('GLib')
const Soup = gi.require('Soup')
const { describe, it, mustThrow, expect, assert } = require('./__common__.js')

Gtk.init()


describe('WrapperFromGObject', () => {
  it('works', () => {
    const result = Gtk.Button.newFromStock(Gtk.STOCK_YES)
  })
})

describe('new GObject({ ... })', () => {

  it('works', () => {
    const uri = GLib.Uri.parse('http://google.com', GLib.UriFlags.NONE)
    const message = new Soup.Message({
      method: 'GET',
      uri: uri,
    })

    expect(message.method, 'GET')
    assert(message.uri instanceof GLib.Uri, 'message.uri not instanceof Soup.Uri')
  })

  it('fails with wrong property types',
    mustThrow(/Cannot convert value.*to type GUri/, () => {
      const message = new Soup.Message({
        uri: 'http://google.com', // invalid type, should be GUri
      })
    }))

  it('fails when passed invalid properties',
    mustThrow(`Invalid property name: INVALID_PROP_NAME`, () => {
      const mark = new Gtk.TextMark({ name: 'mark-name', INVALID_PROP_NAME: false })
    }))
})
