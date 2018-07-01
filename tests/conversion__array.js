/*
 * conversion__array.js
 */


const path = require('path')
const gi = require('../lib/')
const glib = gi.require('GLib')
const gtk = gi.require('Gtk')

/*
 * IN-array
 */
{
  const data = [ 104, 101, 108, 108, 111 ]
  const result = glib.base64Encode(data, data.length)
  console.log('Result:', result)
  console.assert(result === Buffer.from('hello').toString('base64'))
}

/*
 * OUT-array
 */
{
  const filepath = __filename
  const result = glib.fileGetContents(filepath)
  console.log('Result:', result)
  console.assert(result[0] === true, 'glib_file_get_contents failed')
  console.assert(result[1].length === result[2], 'returned length is wrong')
  console.log('Content:\n-----\n'
    + result[1].map(c => String.fromCharCode(c)).join('')
    + '\n-----\n'
  )
}

/*
 * INOUT-array
 */
{
  const result = gtk.init(['argument1', '--gtk-debug', 'misc', 'argument2'])
  console.log('Result:', result)
  console.assert(result[0] === 'argument1')
  console.assert(result[1] === 'argument2')
}

console.log('Success')
