/*
 * require__lazy.js
 *
 * Modules are populated with lazy accessors: a class is only materialized
 * (prototype decorated with its methods/properties) on first access. These
 * tests cover the paths where a type is reached without ever being named in
 * JS, which the C++ type-materializer hook must handle.
 */

const gi = require('../lib/')
const common = require('./__common__.js')

const Gio = gi.require('Gio')
const GLib = gi.require('GLib')

common.describe('lazy type materialization', () => {

  common.it('materializes classes on first access, with inherited levels', () => {
    const Gtk = gi.require('Gtk', '3.0')
    // ApplicationWindow's ancestors (Window, Widget, ...) were never named:
    // the C++ hook must have decorated every prototype in the chain.
    const proto = Gtk.ApplicationWindow.prototype
    common.assert(typeof proto.setShowMenubar === 'function',
      'own method missing')
    common.assert(typeof proto.setTitle === 'function',
      'inherited Gtk.Window method missing')
    common.assert(typeof proto.getVisible === 'function',
      'inherited Gtk.Widget method missing')
  })

  common.it('materializes object classes reached from C first', () => {
    // queryInfo() returns a GFileInfo; Gio.FileInfo is never named in JS
    // before the wrapper is created, so the class template creation in C++
    // must materialize it.
    const file = Gio.File.newForPath('/')
    const info = file.queryInfo('standard::*', 0, null)
    common.assert(info.constructor.name === 'GFileInfo',
      `wrong constructor: ${info.constructor.name}`)
    common.assert(typeof info.getName === 'function',
      'Gio.FileInfo method missing on C-created wrapper')
    common.expect(info.getName(), '/')
  })

  common.it('materializes boxed classes reached from C first', () => {
    // getModificationDateTime() returns a GDateTime (boxed); GLib.DateTime is
    // never named in JS before the wrapper is created.
    const file = Gio.File.newForPath('/')
    const info = file.queryInfo('time::*', 0, null)
    const mtime = info.getModificationDateTime()
    common.assert(mtime !== null, 'no modification time')
    common.assert(typeof mtime.format === 'function',
      'GLib.DateTime method missing on C-created wrapper')
    common.assert(/^\d{4}$/.test(mtime.format('%Y')), 'format() broken')
  })

  common.it('keeps interface methods on private types (#441)', () => {
    // GLocalFile is a private type implementing the public Gio.File
    // interface; its methods come from ApplyInterfaceMethods in C++.
    const file = Gio.File.newForPath('/')
    common.assert(typeof file.getPath === 'function',
      'interface method missing on private type')
    common.expect(file.getPath(), '/')
  })

  common.it('registers GTypes for by-name lookups without JS access', () => {
    // The eager loop used to call get_g_type() on every class as a side
    // effect; by-name lookups depend on that registration having happened.
    // Gio.MemoryOutputStream is never touched as a JS object here.
    const GObject = gi.require('GObject')
    const gtype = GObject.typeFromName('GMemoryOutputStream')
    common.assert(gtype !== 0 && gtype !== 0n && gtype !== null,
      'GType not registered for un-materialized class')
  })

  common.it('supports plain assignment over lazy accessors', () => {
    // Overrides and getInterface() write straight into the module.
    const before = Object.getOwnPropertyDescriptor(GLib, 'PRIORITY_LOW')
    common.assert(typeof before.get === 'function' || 'value' in before,
      'unexpected property shape')
    GLib.PRIORITY_LOW = -42
    common.expect(GLib.PRIORITY_LOW, -42)
  })

})
