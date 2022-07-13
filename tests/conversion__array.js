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

describe('OUT-array (zero-terminated, of strings)', () => {
  const string = 'string with spéciäl characters'
  const locale = 'fr_CA'

  const result = glib.strTokenizeAndFold(string, locale)
  console.log('Result:', result)
  const [tokens, alternates] = result

  expect(tokens, [ 'string', 'with', 'spéciäl', 'characters' ])
  expect(alternates, [ 'special' ])
})


// The below test fails on Windows with:
// Error: Failed to dup() in child process (Bad file descriptor)
//    ...
//    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:77:12)
//    at node:internal/main/run_main_module:17:47

process.platform !== 'win32' && describe('OUT-array (zero-terminated, of guint8)', () => {
  const cmd = 'echo foo'
  const result = glib.spawnCommandLineSync(cmd)

  // @standard_output: (out) (array zero-terminated=1) (element-type guint8) (optional): return location for child output
  // Because (element-type guint8), the result becomes array of numbers, not string.
  const [success, standardOutput] = result
  const expectedStdout = Array.from('foo\n').map(c => c.codePointAt(0))

  expect(success, true)
  expect(standardOutput, expectedStdout)
});

// TODO: disabled due to possible issue with gtk_init. No viable candidates
//       at this moment, this needs to be re-activated when one is found
//
// describe('INOUT-array', () => {
//   const result = gtk.init(['argument1', '--gtk-debug', 'misc', 'argument2'])
//   console.log('Result:', result)
//   assert(result[0] === 'argument1')
//   assert(result[1] === 'argument2')
// })
