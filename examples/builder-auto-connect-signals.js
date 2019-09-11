const fs = require('fs')
const path   = require('path')
const performance = require('perf_hooks').performance
const gi = require('../lib')
const Gdk = gi.require('Gdk', '3.0')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()

const gladeFile = path.join(__dirname, './builder-auto-connect-signals.glade')
const builder = Gtk.Builder.newFromFile(gladeFile)
const win = builder.getObject('mainWindow')

win.setDefaultSize(600, 400)

const handlers = {}

handlers.onWindowShow = Gtk.main
handlers.onWindowDestroy = Gtk.mainQuit

handlers.onCloseBtnClicked = function () {
  win.close()
  console.log('window closed')
}

handlers.onBtnActionClicked = function () {
  let start = performance.now()

  Promise.resolve().then(() => {
    console.log('event promise.then() called, ' + (performance.now() - start))
  })

  process.nextTick(() => {
    console.log('event nextTick() called, ' + (performance.now() - start))
  })
}

// Connect to signals that specified on glade file
builder.connectSignals(handlers)

const label = builder.getObject('helloLabel')
label.setText('Hello World!')

let action = function() {
  return new Promise((resolve) => {
    resolve('CHANGED')
    console.log('new Promise(...)  called')
  })
}

let start = performance.now()
action().then(res => {
  console.log('promise.then() called, ' + (performance.now() - start))
  label.setText(res)
})

process.nextTick(() => {
  console.log('nextTick() called')
  Promise.resolve().then(() => console.log('inner promise.then() called'))
})

win.showAll()
