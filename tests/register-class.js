/*
 * register-class.js
 */

const { describe, it, mustThrow, expect } = require('./__common__')

const gi = require('..')
const Gtk = gi.require('Gtk', '3.0')
// const Gtk = gi.require('Gtk', '4.0') // FIXME: CI doesn't have gtk4


describe('registerClass', () => {

  it('works', () => {

    class CustomWidget extends Gtk.Widget {
      static GTypeName = 'NodeGTKCustomWidget'
      snapshot() {
        console.log('snapshot')
      }
    }

    gi.registerClass(CustomWidget)

    // XXX: this segfaults
    // const custom = new CustomWidget()
    // console.log(custom)
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

