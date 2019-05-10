/*
 * conversion__g_hash.js
 */


const gi = require('../lib/')
const soup = gi.require('Soup')
const common = require('./__common__.js')

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
  common.assert(
    result === 'age=33&name=John'
    || result === 'name=John&age=33'
  )
}

/*
 * as return value
 */
{
  const encodedForm = 'age=33&name=John'

  const result = soup.formDecode(encodedForm)
  console.log('Result:', result)
  common.assert(result.name === 'John')
  common.assert(result.age === '33')
}
