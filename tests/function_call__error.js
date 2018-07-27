/*
 * function_call__error.js
 */


const gi = require('../lib/')
const glib = gi.require('GLib')
const common = require('./__common__.js')

common.describe('function call can throw',
  common.mustThrow(/is not an absolute URI using the/, () => {
    const result = glib.filenameFromUri('http://google.com')
    console.log('Result:', result)
  }))
