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
      virtual_focus() {}
    }
    class DerivedWidget extends CustomWidget {
      virtual_focus() {}
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

  it('binds only virtual_* methods as vfunc overrides', () => {
    class Bound extends Gtk.Widget {
      static GTypeName = 'NodeGTKVfuncBound'
      virtual_focus() {}      // a real vfunc -> wired into the vtable
      dispose() {}           // plain method -> must NOT override GObject::dispose
    }
    gi.registerClass(Bound)

    // The override's super-bridge lands on the parent (native) prototype.
    expect(typeof Gtk.Widget.prototype.virtual_focus, 'function')
    // A plain method named like a vfunc is left untouched: no bridge installed,
    // nothing wired into the GObject vtable (issue #457).
    expect(Object.prototype.hasOwnProperty.call(GObject.Object.prototype, 'dispose'), false)
  })

  it('fails for a virtual_* method that names no vfunc',
    mustThrow(/no virtual function 'no_such_vfunc'/, () => {
      class BadVfunc extends Gtk.Widget {
        static GTypeName = 'NodeGTKBadVfunc'
        virtual_noSuchVfunc() {}
      }
      gi.registerClass(BadVfunc)
    }))

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

