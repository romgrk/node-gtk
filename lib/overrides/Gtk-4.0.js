/*
 * Gtk-4.0.js
 */

const internal = require('../native.js')
const Module = require('../module')
const Gio = Module.require('Gio')

exports.apply = (Gtk) => {

  Gtk.EVENT_CONTINUE = false
  Gtk.EVENT_STOP     = true

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

  const originalGetFile = Gtk.FileChooser.prototype.getFile

  /**
   * Gtk.FileChooserDialog.prototype.getFile
   * @returns {GFile} - The file
   */
  Gtk.FileChooserDialog.prototype.getFile = function getFile() {
    const file = originalGetFile.call(this)
    file.__proto__= Gio.File.prototype
    return file
  }

  /**
   * Gtk.FileChooserWidget.prototype.getFile
   * @returns {GFile} - The file
   */
  Gtk.FileChooserWidget.prototype.getFile = function getFile() {
    const file = originalGetFile.call(this)
    file.__proto__= Gio.File.prototype
    return file
  }
}

function easeOutCubic(t) {
  const p = t - 1
  return p * p * p + 1
}
