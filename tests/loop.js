/*
 * loop.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()

setTimeout(() => {
  console.log('timeout')
}, 1000)

const promise = new Promise(resolve => resolve('promise resolved'))
promise.then(result => console.log(result))

setTimeout(() => {
  console.log('quit')
  Gtk.mainQuit()
}, 5000)
Gtk.main()
