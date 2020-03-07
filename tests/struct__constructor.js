/*
 * struct__constructor.js
 */


const path = require('path')
const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gdk = gi.require('Gdk')
const Gtk = gi.require('Gtk')
const Gio = gi.require('Gio')
const { describe, it, mustThrow, expect, assert } = require('./__common__.js')

Gtk.init()

describe('with constructor (no arguments)', () => {
  const border = new Gtk.Border()

  console.log('Result:', border)
  assert(border instanceof Gtk.Border, 'result not instanceof Gtk.Border')
})

describe('with constructor (arguments)', () => {

  it('works', () => {
    const gradient = new Gtk.Gradient(0.1, 0.5, 2, 3)
    console.log(gradient.toString())
  })

  it('fails when missing arguments',
    mustThrow('Not enough arguments; expected 4, have 0', () => {
      const gradient = new Gtk.Gradient()
    }))
})

describe('without constructor, size > 0', () => {
  const rgba = new Gdk.RGBA()
  rgba.red = 200 / 255
  const string = rgba.toString()

  console.log('Result:', rgba)
  console.log(string)

  expect(string, 'rgba(200,0,0,0)')
  assert(rgba instanceof Gdk.RGBA, 'result not instanceof Gdk.RGBA')
})

describe('with initial values', () => {
  const color = new Gdk.RGBA({ red: 0.1, green: 0.5, blue: 1 })
  const string = color.toString()

  console.log('Result:', color, string)

  expect(color.red,   0.1)
  expect(color.green, 0.5)
  expect(color.blue,  1)
  expect(color.alpha, 0)
  expect(string, 'rgba(26,128,255,0)')
  assert(color instanceof Gdk.RGBA, 'result not instanceof Gdk.RGBA')
})

describe('without constructor, size === 0',
  mustThrow('Boxed allocation failed: no constructor found', () => {
    const result = new Gdk.Atom()
  }))
