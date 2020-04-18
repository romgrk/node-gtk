/*
 * Pango.js
 */

const {override} = require('../utils.js')

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
      originalSetMarkup.call(this, markup, -1)
    }
  })

  /**
   * Pango.Layout.prototype.setText
   * @param {string} markup
   */
  override(Pango.Layout, 'setText', originalSetText => {
    return function setText(markup) {
      originalSetText.call(this, markup, -1)
    }
  })
}
