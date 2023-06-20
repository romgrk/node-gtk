/*
 * conversion__g_hash.js
 */


const gi = require('../lib/')
const Soup = gi.require('Soup', '3.0')
const common = require('./__common__.js')

/*
 * as argument
 */
{
  const formData = {
    name: 'John',
    age: '33',
  }

  const result = Soup.formEncodeHash(formData)
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

  const result = Soup.formDecode(encodedForm)
  console.log('Result:', result)
  common.assert(result.name === 'John')
  common.assert(result.age === '33')
}
