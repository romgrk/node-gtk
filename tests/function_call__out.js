/*
 * function_call__out.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const GLib = gi.require('GLib')
const { describe, it, expect } = require('./__common__.js')

gi.startLoop()
// Gtk.init()

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
    // XXX: This one is failing
    console.log('before')
    const newData = GLib.base64Decode(data, data.length)
    console.log('after')
    console.log(newData)
    // console.log([newData, length])
    const decodedText = newData.map(c => String.fromCharCode(c)).join('')
    console.log([decodedText])
    // expect(result, 'hello')
  })

  // see ./conversion__array for array tests

  // TODO: missing tests for structs
  // it('works with complex types', () => {})
})
