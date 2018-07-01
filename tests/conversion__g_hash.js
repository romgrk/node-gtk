/*
 * conversion__g_hash.js
 */


const gi = require('../lib/')
const soup = gi.require('Soup')

/*
 * as argument
 */
{
  const formData = {
    name: 'John',
    age: '33',
  }

  const result = soup.formEncodeHash(formData)
  console.log('Result:', result)
  console.assert(result === 'age=33&name=John')
}

/*
 * as return value
 */
{
  const encodedForm = 'age=33&name=John'

  const result = soup.formDecode(encodedForm)
  console.log('Result:', result)
  console.assert(result.name === 'John')
  console.assert(result.age === '33')
}
