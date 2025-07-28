/*
 * struct__fields.js
 */


const path = require('path')
const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gdk = gi.require('Gdk', '3.0')
const common = require('./__common__.js')

/*
 * get/set works
 */
{
  const color = new Gdk.Color()
  {
    /*
     * structs are zero initialized
     */
    const result = color.blue
    console.log('Result:', result)
    common.assert(result === 0, "struct not zero initialized")
  }
  color.blue = 100
  {
    const result = color.blue
    console.log('Result:', result)
    common.assert(result === 100)
  }
}
