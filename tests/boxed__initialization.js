/*
 * boxed__initialization.js
 */


const gi = require('../lib/')
const Gdk = gi.require('Gdk')
const Pango = gi.require('Pango')
const { describe, it, mustThrow, expect, assert } = require('./__common__.js')

Gdk.init([])


describe('Boxed initialization', () => {

  it('works for zero-args constructor', () => {
    const color = new Gdk.RGBA()
    expect(color.toString(), 'rgba(0,0,0,0)')
  })

  it('works with object initializer', () => {
    const color = new Gdk.RGBA({ red: 0.5, blue: 0.5, green: 0.5, alpha: 0.5 })
    expect(color.toString(), 'rgba(128,128,128,0.5)')
  })

  it('works with non-zero-args constructor', () => {
    const attr = new Pango.AttrSize(10)
    expect(attr.toString(), '[object AttrSize]')
  })

  it('fails with non-zero-args constructor and bad arguments',
    mustThrow("Expected argument of type Number for parameter size, got 'abc'", () => {
      const attr = new Pango.AttrSize('abc')
    }))
})
