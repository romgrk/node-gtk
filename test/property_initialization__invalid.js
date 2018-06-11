/*
 * v8togvalue_soup.js
 */

const gi = require('../lib/')
const Soup = gi.require('Soup')

const message = new Soup.Message({
  method: 'GET',
  uri: 'http://google.com', // invalid type, should be SoupURI
})

console.log(message)
