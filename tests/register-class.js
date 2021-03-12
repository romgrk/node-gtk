/*
 * register-class.js
 */

const { describe, it, mustThrow, expect } = require('./__common__')

const gi = require('..')
const GObject = gi.require('GObject')
const Gtk = gi.require('Gtk', '3.0'); Gtk.init([])


describe('registerClass', () => {

  it('works', (done) => {

    class CustomWidget extends Gtk.Widget {
      static GTypeName = 'NodeGTKCustomWidget'
      focus() {}
    }
    class DerivedWidget extends CustomWidget {
      focus() {}
    }

    gi.registerClass(CustomWidget)
    gi.registerClass(DerivedWidget)

    const custom = new CustomWidget()
    const derived = new DerivedWidget()
    console.log(custom)
    console.log(derived)
    expect(custom instanceof Gtk.Widget, true)
    expect(derived instanceof Gtk.Widget, true)
    expect(GObject.typeName(custom.__gtype__), CustomWidget.GTypeName)
    expect(GObject.typeName(derived.__gtype__), DerivedWidget.name)
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

