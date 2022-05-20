/*
 * object__initialization.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const Soup = gi.require('Soup', '2.4')
const { describe, it, mustThrow, expect, assert } = require('./__common__.js')

Gtk.init()


describe('WrapperFromGObject', () => {
  it('works', () => {
    const result = Gtk.Button.newFromStock(Gtk.STOCK_YES)
  })
})

describe('new GObject({ ... })', () => {

  it('works', () => {
    const uri = new Soup.URI('http://google.com')
    const message = new Soup.Message({
      method: 'GET',
      uri: uri,
    })

    expect(message.method, 'GET')
    assert(message.uri instanceof Soup.URI, 'message.uri not instanceof Soup.URI')
  })

  it('fails with wrong property types',
    mustThrow(/Cannot convert value.*to type SoupURI/, () => {
      const message = new Soup.Message({
        uri: 'http://google.com', // invalid type, should be SoupURI
      })
    }))

  it('fails when passed invalid properties',
    mustThrow(`Invalid property name: INVALID_PROP_NAME`, () => {
      const mark = new Gtk.TextMark({ name: 'mark-name', INVALID_PROP_NAME: false })
    }))
})
