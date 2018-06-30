/*
 * conversion__g_hash.js
 */


const gi = require('../lib/')
const glib = gi.require('GLib')

// The example below doesnt work, we need an example were
// the hashtable keys/values type is defined.
throw new Error('not implemented')

const table = { key: 'value' }

{
  const result = glib.hashTableContains(table, 'key')
  console.log('Result:', result)
  console.assert(result === true, 'Table doesnt contain "key"')
}
{
  const result = glib.hashTableContains(table, 'unexistent')
  console.log('Result:', result)
  console.assert(result === false, 'Table contains "unexistent"')
}
