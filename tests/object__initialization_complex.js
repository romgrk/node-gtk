/*
 * property_initialization__object.js
 */


const gi = require('../lib/')
const Soup = gi.require('Soup')
const common = require('./__common__.js')

const message = new Soup.Message({
  method: 'GET',
  uri: new Soup.URI('http://google.com'),
})

console.log(message)
