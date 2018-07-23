/*
 * object__initialization.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk')
const Soup = gi.require('Soup')
const common = require('./__common__.js')

Gtk.init()


common.describe('new GObject({ ... })', () => {
  const message = new Soup.Message({
    method: 'GET',
    uri: new Soup.URI('http://google.com'),
  })

  common.expect(message.method, 'GET')
  common.assert(message.uri instanceof Soup.URI, 'message.uri not instanceof Soup.URI')

  console.log(message)
})


common.describe('WrapperFromGObject', () => {
  const result = Gtk.Button.newFromStock(Gtk.STOCK_YES)
  console.log(result)
})
