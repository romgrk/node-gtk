/*
 * function_call__error.js
 */


const gi = require('../lib/')
const glib = gi.require('GLib')

try {
  const result = glib.filenameFromUri('http://google.com')
  console.log('Result:', result)
} catch (e) {
  console.assert(e.message.includes('is not an absolute URI using the “file” scheme'),
    'Unexpected error: ' + e.message)

  console.log('Got expected error:', e)
  process.exit(0)
}

console.error('Expected error')
process.exit(1)
