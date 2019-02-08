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

  /**
   * Pango.Layout.prototype.setText
   * @param {string} markup
   */
  override(Pango.Layout, 'setText', originalSetText => {
    return function setText(markup) {
      originalSetText.call(this, markup, countUtf8Bytes(markup))
    }
  })
}
