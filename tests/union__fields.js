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
 * unions are zero initialized
 * (vInt64 is a gint64, so it reads back as BigInt — #323, #149)
 */
{
  const result = tk.vInt64
  console.log('Result:', result)
  common.assert(result === 0n, "union not zero initialized")
}

/*
 * get/set works
 * A Number is accepted on the way in; a gint64 reads back as BigInt, and a
 * value above Number.MAX_SAFE_INTEGER now round-trips with full precision.
 */
{
  tk.vInt64 = 2n ** 53n + 1n
  const result = tk.vInt64
  console.log('Result:', result)
  common.assert(result === 2n ** 53n + 1n)
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
