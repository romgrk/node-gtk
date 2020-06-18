/*
 * conversion__array.js
 */


const fs = require('fs')
const path = require('path')
const gi = require('../lib/')
const glib = gi.require('GLib')
const gtk = gi.require('Gtk', '3.0')
const common = require('./__common__.js')

/*
 * IN-array
 */
{
  const data = [ 104, 101, 108, 108, 111 ] // hello
  const result = glib.base64Encode(data, data.length)
  console.log('Result:', result)
  common.assert(result === Buffer.from('hello').toString('base64'))
}



/*
 * OUT-array (array-length after)
 */
{
  const data = [ 104, 101, 108, 108, 111 ] // hello
  const result = glib.computeChecksumForData(glib.ChecksumType.MD5, data)
  console.log('Result:', result)
  common.assert(result === '5d41402abc4b2a76b9719d911017c592', 'glib.computeChecksumForData failed')
}

/*
 * OUT-array (array-length before)
 */
{
  const filepath = __filename
  const result = glib.fileGetContents(filepath)
  console.log('Result:', result)
  const content = result[1].map(c => String.fromCharCode(c)).join('')
  const actualContent = fs.readFileSync(filepath).toString()
  common.assert(result[0] === true, 'glib_file_get_contents failed')
  common.assert(content === actualContent, 'file content is wrong')
}

/*
 * INOUT-array
 */
{
  const result = gtk.init(['argument1', '--gtk-debug', 'misc', 'argument2'])
  console.log('Result:', result)
  common.assert(result[0] === 'argument1')
  common.assert(result[1] === 'argument2')
}

console.log('Success')
