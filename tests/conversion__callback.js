/*
 * conversion__callback.js
 */


const gi = require('../lib/')
const GLib = gi.require('GLib')

GLib.unixSignalAdd(GLib.PRIORITY_DEFAULT_IDLE, 2 /* SIGINT */, () => {
    console.log('SIGINT')
    process.exit(0)
})

process.kill(process.pid, 'SIGINT')

console.log('Expected to exit in callback')
process.exit(1)
