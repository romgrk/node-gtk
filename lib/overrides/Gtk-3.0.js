/*
 * Gtk-3.0.js
 */

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
  const originalGetSizeRequest = Gtk.Widget.prototype.getSizeRequest
  Gtk.Widget.prototype.getSizeRequest = function() {
    const [width, height] = originalGetSizeRequest.call(this)
    return { width, height }
  }

}
