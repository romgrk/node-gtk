/*
 * function_call__invalid_type.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const Soup = gi.require('Soup', '3.0')
const GLib = gi.require('GLib', '2.0')
const common = require('./__common__.js')

test(`Soup.Message#setUri`, () => {
  const message = new Soup.Message({
    method: 'GET',
  })
  message.setUri('http://thishouldbeaSoupURI.com')
})

test(`Gtk.init(45)`, () => {
  Gtk.init(45)
})

test(`GLib.random_int_range(0, 'string')`, () => {
  GLib.randomIntRange(0, 'string')
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
