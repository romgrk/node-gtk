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
    Gtk.main = function main() {
        const loopStack = internal.GetLoopStack()

        loopStack.push(Gtk.mainQuit)
        originalMain()
        loopStack.pop()
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
