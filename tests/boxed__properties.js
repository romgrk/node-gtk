/*
 * boxed__properties.js
 */


const gi = require('../lib/')
const Gdk = gi.require('Gdk', '3.0')
const Pango = gi.require('Pango')
const { describe, it, mustThrow, expect, assert } = require('./__common__.js')

Gdk.init([])

const color = new Gdk.RGBA()

describe('Boxed properties', () => {

  it('setters', () => {
    color.red = 0.5
    color.blue = 0.5
    color.green = 0.5
    color.alpha = 0.5
    expect(color.toString(), 'rgba(128,128,128,0.5)')
  })

  it('getters', () => {
    expect(color.red, 0.5)
    expect(color.blue, 0.5)
    expect(color.green, 0.5)
    expect(color.alpha, 0.5)
  })
})
