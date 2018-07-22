/*
 * object__initialization.js
 */


const gi = require('../lib/')
const Soup = gi.require('Soup')
const common = require('./__common__.js')

const message = new Soup.Message({
  method: 'GET',
  uri: new Soup.URI('http://google.com'),
})

common.expect(message.method, 'GET')
common.assert(message.uri instanceof Soup.URI, 'message.uri not instanceof Soup.URI')

console.log(message)
