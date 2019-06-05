/*
 * Gtk-3.0.js
 */

const gi = require('../../lib/index.js')
const GObject = gi.require('GObject')
const internal = require('../native.js')

/**
 * @typedef {Object} Dimension
 * @property {number} width
 * @property {number} height
 */

exports.apply = (Gtk) => {

    const originalMain = Gtk.main
    const originalQuit = Gtk.mainQuit

    let userCallingQuit = false
    Gtk.main = function main() {
        const loopStack = internal.GetLoopStack()

        loopStack.push(originalQuit)
        originalMain()
        if (userCallingQuit) {
          loopStack.pop()
        }
        userCallingQuit = false
    }
    Gtk.mainQuit = function mainQuit() {
        if (Gtk.mainLevel() === 0)
          return
        userCallingQuit = true
        originalQuit()
    }


  /*
   * Gtk.Widget
   */

  /**
   * Gtk.Widget.prototype.getSizeRequest
   * @returns {Dimension}
   */
  const getSizeRequest = Gtk.Widget.prototype.getSizeRequest
  Gtk.Widget.prototype.getSizeRequest = function() {
    const [width, height] = getSizeRequest.call(this)
    return { width, height }
  }


  /*
   * Gtk.Builder
   */

  /**
   * Gtk.Builder.prototype.getObject
   * @returns {GObject}
   */
  const getObject = Gtk.Builder.prototype.getObject
  Gtk.Builder.prototype.getObject = function(name) {
    const object = getObject.call(this, name)
    const typeName = GObject.typeName(object.__gtype__)

    if (typeName.startsWith('Gtk')) {
      const klass = Gtk[typeName.replace(/^Gtk/, '')]

      if (klass) {
        object.__proto__ = klass.prototype
      }
    }

    return object
  }

}
