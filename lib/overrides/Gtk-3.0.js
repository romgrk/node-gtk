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

    /*
     * main loop functions
     */
    {

      const originalMain = Gtk.main
      const originalQuit = Gtk.mainQuit

      let placeholderIntervalID
      let userCallingQuit = false

      Gtk.main = function main() {
          const loopStack = internal.GetLoopStack()

          /*
           * To keep the nodejs event loop alive, we need to have something running.
           */
          if (placeholderIntervalID === undefined) {
            placeholderIntervalID = setInterval(() => { /* noop */ }, 60 * 60 * 1000)
          }

          loopStack.push(originalQuit)

          originalMain()

          if (userCallingQuit) {
            loopStack.pop()
          }

          userCallingQuit = false

          if (Gtk.mainLevel() === 0) {
            placeholderIntervalID = clearInterval(placeholderIntervalID)
          }
      }

      Gtk.mainQuit = function mainQuit() {
          if (Gtk.mainLevel() === 0)
            return
          userCallingQuit = true
          originalQuit()
      }

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
   * Gtk.Builder.prototype.connectSignals
   * @returns void
   */
  Gtk.Builder.prototype.connectSignals = function(handlers) {
    if (!handlers) return
    this.connectSignalsFull(function (builder, object, signal, handler) {
      if (handlers[handler] && typeof handlers[handler] == 'function') {
        object.connect(signal, handlers[handler])
      }
    })
  }
}
