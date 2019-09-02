/*
 * cairo-font.js
 */

const fs = require('fs')
const path = require('path')
const ft = require('freetype2')
const gi = require('../')
const Cairo = gi.require('cairo')

fs.readFile(path.join(__dirname, './Hack-Regular.ttf'), function(err, buffer) {
  if (err)
    throw err
  loadFont(buffer)
})

function loadFont(buffer) {
  const result = {}
  const err = ft.New_Memory_Face(buffer, 0, result)

  if (err)
    throw err

  const face = result.face
  console.log(face)

  const font = Cairo.FontFace.createForFtFace(face.pointer)
  console.log(font)
  font.setSynthesize(Cairo.FtSynthesize.BOLD)
  const synth = font.getSynthesize()
  console.log({ font, synth, bold: 1 })
  console.assert(synth === Cairo.FtSynthesize.BOLD) 
}
