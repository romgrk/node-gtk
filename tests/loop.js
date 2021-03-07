/*
 * loop.js
 *
 * Promise & setTimeout not run when inside signal callback
 * https://github.com/romgrk/node-gtk/issues/121
 */

const gi = require('..')
const GLib = gi.require('GLib', '2.0')
const Gtk = gi.require('Gtk', '3.0')
const { expect, assert } = require('./__common__')

Gtk.init([])

const events = []
const expectedEvents = [
  'run',
  'activate',
  'realize',
  'clicked',
  'promise:start-before',
  'clicked:settimeout',
  'clicked:promise-settimeout',
  'clicked:promise-resolved',
]
const addEvent = e => {
  console.log(e)
  events.push(e)
}


const loop = GLib.MainLoop.new(null, false)
const app = new Gtk.Application('com.github.romgrk.node-gtk.demo', 0)
app.on('activate', onActivate)

let window
let actionButton


let resolve
const action = new Promise(r => { resolve = r })
action.then(() => {
  addEvent('promise:start-before')
})

setTimeout(() => {
  if (window) window.close()
  assert(false, 'Timeout should not be reached')
}, 2000).unref()

addEvent('run')

const status = app.run([])

console.log('Finished with status:', status)
console.log(events)
assert(
  events.every((e, i) => e === expectedEvents[i]),
  `Wrong events: ${JSON.stringify(events)}`
)

function onActivate() {
  addEvent('activate')

  window = new Gtk.ApplicationWindow(app)
  window.setTitle('Window')
  window.setDefaultSize(200, 200)
  window.on('delete-event', onQuit)
  window.on('realize', onRealize)

  const ui = `
    <?xml version="1.0" encoding="UTF-8"?>
    <interface>
      <requires lib="gtk" version="4.0"/>
      <object class="GtkBox" id="root">
        <property name="orientation">vertical</property>
        <child>
          <object class="GtkButton" id="actionButton">
            <property name="label" translatable="yes">Action</property>
            <property name="receives_default">1</property>
          </object>
        </child>
      </object>
    </interface>
  `

  const builder = Gtk.Builder.newFromString(ui, ui.length)
  const root = builder.getObject('root')

  actionButton = builder.getObject('actionButton')
  actionButton.on('clicked', () => {
    addEvent('clicked')

    // this runs, and promise is resolved
    let action = new Promise(resolve => {
      setTimeout(
        () => {
          addEvent('clicked:promise-settimeout')
          resolve()
        },
        100
      )
    })

    setTimeout(() => {
      addEvent('clicked:settimeout')
    }, 50)

    action.then(() => {
      addEvent('clicked:promise-resolved')
      window.close()
    })
  })

  window.add(root)
  window.present()

  resolve()
  gi.startLoop()
  loop.run()
}

function onRealize() {
  addEvent('realize')
  actionButton.emit('clicked')
}

function onQuit() {
  loop.quit()
  return false
}
