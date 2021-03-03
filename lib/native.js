/*
 * native.js
 */

const binary = require('@mapbox/node-pre-gyp')
const path = require('path')

const packagePath = path.resolve(path.join(__dirname,'../package.json'))
const bindingPath = binary.find(packagePath)

const binding = require(bindingPath)

module.exports = binding
