/*
 * function_call__invalid_type.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk')
const Soup = gi.require('Soup')
const glib = gi.require('GLib')

test(`Soup.Message#setUri`, () => {
  const message = new Soup.Message({
    method: 'GET',
  })
  message.setUri('http://thishouldbeaSoupURI.com')
})

test(`Gtk.init(45)`, () => {
  Gtk.init(45)
})

test(`glib.random_int_range(0, 'string')`, () => {
  glib.random_int_range(0, 'string')
})


function test(msg, fn) {
  try {
    fn()
  } catch (e) {
    if (!(e instanceof TypeError)) {
      console.error(msg, ': expected TypeError, got:\n', e)
      process.exit(1)
    }

    console.log(msg)
    console.log('Got expected error:', e, '\n')
    return
  }

  console.error(msg, ': expected TypeError but didnt throw')
  process.exit(2)
}
