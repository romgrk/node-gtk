/*
 * conversion__g_s_list.js
 */

const gi = require('../lib/')
const Soup = gi.require('Soup')
const common = require('./__common__.js')

const input = 'Content-Type;q=1, Accept;q=0.2, X-Custom;q=0.1, Zero;q=0'

console.log(`Input: "${input}"`)
const [acceptable, unacceptable] = Soup.headerParseQualityList(input)
console.log(acceptable, unacceptable)

common.assert(acceptable[0] === 'Content-Type', `acceptable[0] === 'Content-Type'`, acceptable[0])
common.assert(acceptable[1] === 'Accept',       `acceptable[1] === 'Accept'`,       acceptable[1])
common.assert(acceptable[2] === 'X-Custom',     `acceptable[2] === 'X-Custom'`,     acceptable[2])

// soup_header_parse_quality_list out-argument doesnt seem to be correctly marked as
// caller-allocated, thus we skip the following assertion:
// common.assert(unacceptable[0] === 'Zero',       `unacceptable[0] === 'Zero'`,       unacceptable[0])
