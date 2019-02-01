/*
 * Pango.js
 */

const {override, countUtf8Bytes} = require('../utils.js')

exports.apply = (Pango) => {

  /*
   * Pango.Layout
   */

  /**
   * Pango.Layout.prototype.setMarkup
   * @param {string} markup
   */
  override(Pango.Layout, 'setMarkup', originalSetMarkup => {
    return function setMarkup(markup) {
      originalSetMarkup.call(this, markup, countUtf8Bytes(markup))
    }
  })
}
