/*
 * loop.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()

let didCallTimeout = false
let didCallPromise = false

setTimeout(() => {
  console.log('timeout')
  didCallTimeout = true
}, 500)

const promise = new Promise(resolve => resolve('promise resolved'))
promise.then(result => {
  console.log(result)
  didCallPromise = true
})

setTimeout(() => {
  Gtk.mainQuit()
  console.assert(didCallTimeout, 'did not call timeout')
  console.assert(didCallPromise, 'did not call promise')
  console.log('done')
}, 1000)

Gtk.main()
