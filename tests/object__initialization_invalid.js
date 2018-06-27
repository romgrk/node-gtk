/*
 * v8togvalue_soup.js
 */

const gi = require('../lib/')
const Soup = gi.require('Soup')

try {
  const message = new Soup.Message({
    method: 'GET',
    uri: 'http://google.com', // invalid type, should be SoupURI
  })
}
catch(e) {
  console.assert(e instanceof TypeError, 'Expected error to be a TypeError')
  console.log('Success, got expected error:', e.message)
  process.exit(0)
}

console.error('Error: didnt throw')
process.exit(1)
