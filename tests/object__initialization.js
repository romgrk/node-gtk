/*
 * object__initialization.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk')
const Soup = gi.require('Soup')
const { describe, it, mustThrow, expect, assert } = require('./__common__.js')

Gtk.init()


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

  it('fails with wrong argument types',
    mustThrow('Value is not instance of boxed SoupURI', () => {
      const message = new Soup.Message({
        uri: 'http://google.com', // invalid type, should be SoupURI
      })
    }))
})


describe('WrapperFromGObject', () => {
  const result = Gtk.Button.newFromStock(Gtk.STOCK_YES)
})
