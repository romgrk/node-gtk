/*
 * loop.js
 *
 * Promise & setTimeout not run when inside signal callback
 * https://github.com/romgrk/node-gtk/issues/121
 */

const gi = require('..')
const GLib = gi.require('GLib', '2.0')
const Gtk = gi.require('Gtk', '4.0')
const { expect, assert } = require('./__common__')

const events = []
const expectedEvents = [
  'realize',
  'clicked',
  'promise:start-before',
  'clicked:settimeout',
  'clicked:promise-settimeout',
  'clicked:promise-resolved',
]


const loop = GLib.MainLoop.new(null, false)
const app = new Gtk.Application('com.github.romgrk.node-gtk.demo', 0)
app.on('activate', onActivate)

let window
let actionButton


let resolve
const action = new Promise(r => { resolve = r })
action.then(() => {
  events.push('promise:start-before')
})

setTimeout(() => {
  if (window) window.close()
  assert(false, 'Timeout should not be reached')
}, 2000).unref()

const status = app.run([])

console.log('Finished with status:', status)
console.log(events)
assert(
  events.every((e, i) => e === expectedEvents[i]),
  `Wrong events: ${JSON.stringify(events)}`
)

function onActivate() {
  window = new Gtk.ApplicationWindow(app)
  window.setTitle('Window')
  window.setDefaultSize(200, 200)
  window.on('close-request', onQuit)
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
    events.push('clicked')

    // this runs, and promise is resolved
    let action = new Promise(resolve => {
      setTimeout(
        () => {
          events.push('clicked:promise-settimeout')
          resolve()
        },
        100
      )
    })

    setTimeout(() => {
      events.push('clicked:settimeout')
    }, 50)

    action.then(() => {
      events.push('clicked:promise-resolved')
      window.close()
    })
  })

  window.setChild(root)
  window.present()

  resolve()
  gi.startLoop()
  loop.run()
}

function onRealize() {
  events.push('realize')
  actionButton.emit('clicked')
}

function onQuit() {
  loop.quit()
  return false
}
