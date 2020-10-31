/*
 * function_call__inout.js
 */

const gi = require('../lib')
const GLib = gi.require('GLib', '2.0');
const Gtk = gi.require('Gtk', '3.0');
const { describe, it, expect, assert } = require('./__common__.js')

// Gtk.init([])

describe('function inout parameters', () => {
  // it('works with simple types', () => {

  //   const initialText = 'abcdef'
  //   const newText = '_'
  //   const finalText = 'abc_def'

  //   const editable = new Gtk.Entry()
  //   editable.setText(initialText)

  //   let position = 3
  //   position = editable.insertText(newText, newText.length, position)
  //   /* The function updates position to point after the newly inserted text. */

  //   expect(position, 4)
  //   expect(editable.getText(), finalText)
  // })

  // it('works with string types', () => {
  //   console.log(Gtk.init(['argument1', '--gtk-debug', 'misc']))

  //   const data = 'aGVsbG8='
  //   // XXX: This one is failing
  //   const [length, newData] = GLib.base64DecodeInplace(data, data.length)
  //   console.log([length, newData])
  //   console.log([newData.map(c => String.fromCharCode(c)).join('')])
  //   // expect(result, 'hello')
  // })

  // it('works with complex types', () => {})
})
