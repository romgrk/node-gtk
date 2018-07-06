/*
 * struct__fields.js
 */


const path = require('path')
const gi = require('../lib/')
const Gdk = gi.require('Gdk')

const color = new Gdk.Color()
color.blue = 100

const result = color.blue
console.log('Result:', result)
console.assert(result === 100)
