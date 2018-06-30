/*
 * conversion__array.js
 */


const gi = require('../lib/')
const soup = gi.require('Soup')

{
  const data = [1, 2, 3, 4, 5, 6, 7, 8]
  const messageBody = new soup.MessageBody()
  messageBody.append(data, 5)
}
