/*
 * cairo-scaled-font.js
 */

const fs = require('fs')
const path = require('path')
const gi = require('../')
const Cairo = gi.require('cairo')


const font = Cairo.FontFace.create('Arial', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD)
const fontMatrix = new Cairo.Matrix()
const ctm = new Cairo.Matrix()
const options = new Cairo.FontOptions()
const scaledFont = Cairo.ScaledFont.create(font, fontMatrix, ctm, options)
const [glyphs, clusters] = scaledFont.textToGlyphs(0, 0, 'Sphinx of black quartz, judge my vow.', true)
console.log({ scaledFont, glyphs, clusters })
console.log(Array.from(glyphs))
// console.log(Array.from(clusters))
