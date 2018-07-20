/*
 * conversion__callback.js
 */


const gi = require('../lib/')
const glib = gi.require('GLib')
const common = require('./__common__.js')


let count = 0

const source = glib.timeoutAdd(glib.PRIORITY_HIGH, 100, function() {
    console.log('called')

    count += 1

    return glib.SOURCE_REMOVE
})

setTimeout(() => {
    common.assert(count > 0, 'callback was not called')
    common.assert(count === 1, 'callback wasnt stopped (JS value not returned)')

    console.log('Done')
    process.exit(0)
}, 500)
