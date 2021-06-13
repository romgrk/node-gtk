/*
 * union__fields.js
 */


const path = require('path')
const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gdk = gi.require('Gdk', '3.0')
const common = require('./__common__.js')

const tk = new GLib.TokenValue()

/*
 * get/set works
 */
{
  tk.vInt = Number.MAX_SAFE_INTEGER
  const result = tk.vInt
  console.log('Result:', result)
  common.assert(result === BigInt(Number.MAX_SAFE_INTEGER))
}

/*
 * conversion works
 */
{
  tk.vInt = 257
  const result = tk.vChar
  common.assert(tk.vChar === 1)
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
  common.assert(didThrow)
}
