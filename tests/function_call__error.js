/*
 * function_call__error.js
 */


const gi = require('../lib/')
const glib = gi.require('GLib')

try {
  const result = glib.filename_from_uri('http://google.com')
  console.log('Result:', result)
} catch (e) {
  console.log('Got expected error:', e)
  process.exit(0)
}

console.error('Expected error')
process.exit(1)
