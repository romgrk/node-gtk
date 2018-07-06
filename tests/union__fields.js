/*
 * union__fields.js
 */


const path = require('path')
const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gdk = gi.require('Gdk')

const tk = new GLib.TokenValue()

/*
 * get/set works
 */
{
  tk.vInt = Number.MAX_SAFE_INTEGER
  const result = tk.vInt
  console.log('Result:', result)
  console.assert(result === Number.MAX_SAFE_INTEGER)
}

/*
 * conversion works
 */
{
  tk.vInt = 257
  const result = tk.vChar
  console.assert(tk.vChar === 1)
  console.log('Result:', result)
}

/*
 * fails for complex types
 */
{
  let didThrow = false
  try {
    tk.vString = 'hello'
  } catch (err) {
    didThrow = true
    console.log('Got expected error:', err.message)
  }
  console.assert(didThrow)
}
