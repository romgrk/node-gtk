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

  Gtk.EVENT_CONTINUE = false
  Gtk.EVENT_STOP     = true

  /*
   * main loop functions
   */
  {

    const originalMain = Gtk.main
    const originalQuit = Gtk.mainQuit

    let placeholderIntervalID
    let userCallingQuit = false

    Gtk.main = function main() {
        /* Run before we enter the loop otherwise pending microtasks
         * are not run */
        process._tickCallback()

        const loopStack = internal.GetLoopStack()
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
