/*
 * list-available-modules.js
 */

const gi = require('..')

const util = require('util')
util.inspect.defaultOptions =  {
    maxArrayLength: Infinity,
    colors: true,
    depth: 3
}

gi.listAvailableModules().then(console.log, console.error)
