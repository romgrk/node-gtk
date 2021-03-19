/*
 * Gtk-4.0.js
 */

const internal = require('../native.js')

exports.apply = (Gtk) => {

  /*
   * Gtk.ScrolledWindow
   */

  /**
   * Gtk.ScrolledWindow.prototype.scrollTo
   * @param {number} value
   * @param {bool} [vertical=true]
   * @returns {number} - The tick callback id
   */
  Gtk.ScrolledWindow.prototype.scrollTo = function scrollTo(value, vertical = true) {
    const adj = vertical ? this.getVadjustment() : this.getHadjustment()
    const clock = this.getFrameClock()

    const duration = 200
    const start = adj.getValue()
    const end = value
    const startTime = clock.getFrameTime();
    const endTime = startTime + 1000 * duration;

    return this.addTickCallback((_, clock) => {
      const now = clock.getFrameTime()
      if (now < endTime && adj.getValue() != end) {
        let t = (now - startTime) / (endTime - startTime)
        t = easeOutCubic(t)
        adj.setValue(start + t * (end - start))
        return true /* continue */;
      }

      adj.setValue(end)
      return false /* remove */;
    })
  }
}

function easeOutCubic(t) {
  const p = t - 1
  return p * p * p + 1
}
