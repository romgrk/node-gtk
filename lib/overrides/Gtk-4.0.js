/*
 * Gtk-4.0.js
 */

exports.apply = (Gtk) => {

  Gtk.EVENT_CONTINUE = false
  Gtk.EVENT_STOP     = true

  /**
   * Gtk.Widget.prototype.containsChild
   * @param {Gtk.Widget} child
   * @returns {bool}
   */
  Gtk.Widget.prototype.containsChild = function containsChild(child) {
    let current = child
    while (current) {
      if (current === this)
        return true
      current = current.getParent()
    }
    return false
  }


  Gtk.Widget.prototype._addCssClass = Gtk.Widget.prototype.addCssClass
  Gtk.Widget.prototype._removeCssClass = Gtk.Widget.prototype.removeCssClass

  /**
   * Gtk.Widget.prototype.toggleCssClass
   * @param {string} className
   * @param {bool} [vertical=true]
   * @returns {number} - The tick callback id
   */
  Gtk.Widget.prototype.toggleCssClass = function toggleCssClass(className) {
    if (this.hasCssClass(className))
      this._removeCssClass(className)
    else
      this._addCssClass(className)
  }

  /**
   * Gtk.Widget.prototype.addCssClass
   * @param {string} ...classNames
   */
  Gtk.Widget.prototype.addCssClass = function addCssClass(...classNames) {
    for (let i = 0; i < classNames.length; i++) {
      this._addCssClass(classNames[i])
    }
  }

  /**
   * Gtk.Widget.prototype.removeCssClass
   * @param {string} ...classNames
   */
  Gtk.Widget.prototype.removeCssClass = function removeCssClass(...classNames) {
    for (let i = 0; i < classNames.length; i++) {
      this._removeCssClass(classNames[i])
    }
  }

  /*
   * Gtk.ScrolledWindow
   */

  /**
   * Gtk.ScrolledWindow.prototype.scrollTo
   * @param {number} value
   * @param {bool} [vertical=true]
   * @returns {number} - The tick callback id
   */
  const scrollingWidgets = new WeakMap()
  Gtk.ScrolledWindow.prototype.scrollTo = function scrollTo(value, vertical = true) {
    const adj = vertical ? this.getVadjustment() : this.getHadjustment()
    const clock = this.getFrameClock()

    const duration = 200
    const start = adj.getValue()
    const end = value
    const startTime = clock.getFrameTime();
    const endTime = startTime + 1000 * duration;

    const previousTickId = scrollingWidgets.get(this)
    if (previousTickId)
      this.removeTickCallback(previousTickId)

    const tickId = this.addTickCallback((_, clock) => {
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
    scrollingWidgets.set(this, tickId)
    return tickId
  }

  /* getFile() used to need a manual `file.__proto__ = Gio.File.prototype` fixup
   * because the returned GLocalFile is a private type whose GFile interface
   * methods weren't mixed into its prototype. That is now handled generically
   * for every private type at wrap time (see issue #441), so the override is no
   * longer necessary — the introspected getFile() returns a fully-usable file
   * (or null when nothing is selected). */
}

function easeOutCubic(t) {
  const p = t - 1
  return p * p * p + 1
}
