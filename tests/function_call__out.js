/*
 * function_call__out.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const GLib = gi.require('GLib')
const { describe, it, expect } = require('./__common__.js')

gi.startLoop()
Gtk.init()

describe('function out parameters', () => {
  it('works with simple types', () => {

    const button = new Gtk.Button()
    button.setSizeRequest(100, 50)

    const result = button.getSizeRequest()

    console.log('Result:', result)
    expect(result.width, 100)
    expect(result.height, 50)
  }) 

  it('works with string types', () => {
    const data = 'aGVsbG8='
    const result = GLib.base64Decode(data, data.length)
    console.log(result)
    const decodedText = result.map(c => String.fromCharCode(c)).join('')
    console.log(decodedText)
    expect(result, [ 104, 101, 108, 108, 111 ])
    expect(decodedText, 'hello')
  })

  // see ./conversion__array for array tests

  // TODO: missing tests for structs
  // it('works with complex types', () => {})
})
