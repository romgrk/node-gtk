/*
 * register-class.js
 */

const { describe, it, mustThrow, expect } = require('./__common__')

const gi = require('..')
const Gtk = gi.require('Gtk', '3.0'); Gtk.init([])
// const Gtk = gi.require('Gtk', '4.0') // FIXME: CI doesn't have gtk4


describe('registerClass', () => {

  it('works', (done) => {

    class CustomWidget extends Gtk.Widget {
      static GTypeName = 'NodeGTKCustomWidget'
      static signals = {} // TBD
      static properties = {} // TBD
      measure() {}
      snapshot() {
        console.log('snapshot')
      }
    }

    gi.registerClass(CustomWidget)

    // XXX: this segfaults
    const button = new Gtk.Button()
    const custom = new CustomWidget()
    console.log(button)
    console.log(custom)
  })

  it('fails with invalid GTypeName',
    mustThrow('GTypeName value is invalid: Invalid Gtype Name #$%^&', () => {
      class CustomClass extends Gtk.Widget {
        static GTypeName = 'Invalid Gtype Name #$%^&'
      }
      gi.registerClass(CustomClass)
    }))

  it('fails with already registered GTypeName',
    mustThrow('GType name already registerd: GtkWidget', () => {
      class CustomClass extends Gtk.Widget {
        static GTypeName = 'GtkWidget'
      }
      gi.registerClass(CustomClass)
    }))

  it('fails with non-GObject classes',
    mustThrow('Invalid base class (InvalidClass)', () => {
      class InvalidClass {}
      class InvalidSubclass extends InvalidClass {}
      gi.registerClass(InvalidSubclass)
    }))
})

