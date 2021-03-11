/*
 * Gdk-4.0.js
 */


exports.apply = (Gdk) => {

  /**
   * Gdk.RGBA.create
   * Creates a new color from the given string. Passes value to GdkRGBA.parse()
   * @param {string} value
   */
  Gdk.RGBA.create = function create(value) {
    const color = new Gdk.RGBA()
    color.parse(value)
    return color
  }
}

