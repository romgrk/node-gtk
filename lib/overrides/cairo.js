/*
 * cairo.js
 */


const internal = require('../native.js')

exports.apply = (cairo) => {
    internal.Cairo.init(cairo)
}
