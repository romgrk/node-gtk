/*
 * struct__fields.js
 */


const path = require('path')
const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gdk = gi.require('Gdk')
const common = require('./__common__.js')

/*
 * get/set works
 */
{
  const color = new Gdk.Color()
  color.blue = 100

  const result = color.blue
  console.log('Result:', result)
  common.assert(result === 100)
}
