/*
 * conversion__callback.js
 */


const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gio = gi.require('Gio')
const Gtk = gi.require('Gtk')
const Gdk = gi.require('Gdk')
const GObject = gi.require('GObject')
const common = require('./__common__.js')

gi.startLoop()
Gtk.init()


common.describe('fails when function has GDestroyNotify but not user_data',
  common.mustThrow('Function GLib.test_add_data_func_full has a GDestroyNotify but no user_data, not supported', () => {
      GLib.testAddDataFuncFull(__filename, function(...args) {
        console.log('Called:', args)
      })
  }))


common.describe('calls the callback (no GDestroyNotify, no user_data)', () => {
  let didCall = false

  const loop = new GLib.MainLoop(null, false);
  const task = Gio.Task.new(undefined, undefined, (object, result, user_data) => {
    console.log('Called:', [object, result, user_data])
    didCall = true
    loop.quit();
  })
  task.returnBoolean(true);
  loop.run()

  common.assert(didCall, 'Gio.Task callback not called')
})


// common.describe('calls the callback (GDestroyNotify before, user_data)', () => {
  // Example not found
// })


common.describe('calls the callback (GDestroyNotify after, user_data)', () => {

  let didCall = false

  const window = new Gtk.Window({ type : Gtk.WindowType.TOPLEVEL })
  window.setDefaultSize(400, 50)
  window.on('show', Gtk.main)
  window.on('destroy', Gtk.mainQuit)
  const list = new Gtk.ListBox()
  list.setHeaderFunc((row, before) => {
    console.log('Called:', [row, before])
    didCall = true
    setImmediate(() => window.close())
  })
  const row = new Gtk.ListBoxRow()
  row.add(new Gtk.Label({ label: 'Label' }))
  list.prepend(row)
  window.add(list)
  window.showAll()

  common.assert(didCall, 'not called')
})


common.describe('return value', () => {

  common.it('works', () => {

    const group = new Gtk.AccelGroup()
    const button = new Gtk.Button()
    const closure = new GObject.Closure(32, button)
    group.connect(Gdk.KEY_g, Gdk.ModifierType.CONTROL_MASK, Gtk.AccelFlags.VISIBLE, closure)

    let didCall = false
    const accelKey = group.find((key, closure) => {
      console.log('Called:', [key, closure])
      didCall = true
      return true
    })
    console.log(accelKey)
    common.assert(didCall, 'not called')
  })

  common.it('is type checked',
    common.mustThrow(`Expected return value of type Boolean, got 'undefined'`, () => {

      const group = new Gtk.AccelGroup()
      const button = new Gtk.Button()
      const closure = new GObject.Closure(32, button)
      group.connect(Gdk.KEY_g, Gdk.ModifierType.CONTROL_MASK, Gtk.AccelFlags.VISIBLE, closure)

      const accelKey = group.find((key, closure) => {
        console.log('Called:', [key, closure])

        return undefined
      })
    }))

})



/*
 * propagates exceptions
 */
{
  process.on('uncaughtException', (error) => {
    common.expect(error.message, 'test')

    console.log('Success: exceptions in callbacks are thrown')
  })

  const loop = new GLib.MainLoop(null, false);
  const task = Gio.Task.new(undefined, undefined, (object, result, user_data) => {
    throw new Error('test')
  })
  task.returnBoolean(true);
  loop.run()
}
