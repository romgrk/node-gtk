/*
 * method_call__invalid_type.js
 */


const gi = require('../lib/')
const Soup = gi.require('Soup')

const message = new Soup.Message({
  method: 'GET',
})

message.setUri('http://thishouldbeaSoupURI.com')
