/*
 * conversion__g_s_list.js
 */

const gi = require('../lib/')
const soup = gi.require('Soup')

const res = soup.header_parse_quality_list("Content-Type;q=1, Accept;q=0.2, X-Custom;q=0.1, 0asldk;q=0")
console.log(res)
console.assert(res[0] === 'Content-Type')
console.assert(res[1] === 'Accep')
console.assert(res[2] === 'X-Custom')
