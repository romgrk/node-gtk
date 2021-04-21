/*
 * conversion__array.js
 */


const fs = require('fs')
const path = require('path')
const gi = require('../lib/')
const glib = gi.require('GLib')
const gtk = gi.require('Gtk', '3.0')
const { describe, it, expect, assert } = require('./__common__.js')

describe('IN-array', () => {
  const data = [ 104, 101, 108, 108, 111 ] // hello
  const result = glib.base64Encode(data, data.length)
  console.log('Result:', result)
  assert(result === Buffer.from('hello').toString('base64'))
})

describe('IN-array (Uint8Array)', () => {
  const data = Uint8Array.from([ 104, 101, 108, 108, 111 ]) // hello
  const result = glib.base64Encode(data, data.length)
  console.log('Result:', result)
  assert(result === Buffer.from('hello').toString('base64'))
})

describe('IN-array (Int8Array)', () => {
  const data = Int8Array.from([ 104, 101, 108, 108, 111 ]) // hello
  const result = glib.base64Encode(data, data.length)
  console.log('Result:', result)
  assert(result === Buffer.from('hello').toString('base64'))
})

describe('OUT-array (array-length after)', () => {
  const data = [ 104, 101, 108, 108, 111 ] // hello
  const result = glib.computeChecksumForData(glib.ChecksumType.MD5, data)
  console.log('Result:', result)
  assert(
    result === '5d41402abc4b2a76b9719d911017c592',
    'glib.computeChecksumForData failed'
  )
})

describe('OUT-array (array-length before)', () => {
  const filepath = path.join(__dirname, 'lorem-ipsum.txt')
  const result = glib.fileGetContents(filepath)
  console.log('Result:', result)
  const content = result[1].map(c => String.fromCharCode(c)).join('')
  const actualContent = fs.readFileSync(filepath).toString()

  console.log([content, actualContent])
  assert(result[0] === true, 'glib_file_get_contents failed')
  assert(content === actualContent, 'file content is wrong')
})

describe('OUT-array (zero-terminated)', () => {
  const string = 'string with spéciäl characters'
  const locale = 'fr_CA'

  const result = glib.strTokenizeAndFold(string, locale)
  console.log('Result:', result)
  const [tokens, alternates] = result

  expect(tokens, [ 'string', 'with', 'spéciäl', 'characters' ])
  expect(alternates, [ 'special' ])
})

// TODO: disabled due to possible issue with gtk_init. No viable candidates
//       at this moment, this needs to be re-activated when one is found
//
// describe('INOUT-array', () => {
//   const result = gtk.init(['argument1', '--gtk-debug', 'misc', 'argument2'])
//   console.log('Result:', result)
//   assert(result[0] === 'argument1')
//   assert(result[1] === 'argument2')
// })
