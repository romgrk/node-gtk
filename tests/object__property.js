/*
 * object_get.js
 */

const gi = require('../lib')
const GLib = gi.require('GLib', '2.0')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GdkX11 = gi.require('GdkX11', '3.0')
const { describe, it, expect, assert, isntUndefined } = require('./__common__.js')

gi.startLoop()
Gtk.init()
Gdk.init([])

let win = new Gtk.Window()
let box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
let btn = new Gtk.Button()
let scaleBtn = new Gtk.ScaleButton()
let settings = Gtk.Settings.getDefault()

box.add(btn)
win.add(box)
win.setDefaultSize(400, 100)

win.on('destroy', Gtk.mainQuit)
win.on('show', () => {

  describe('setters', () => {
    // normal props
    console.log('bool:', win.noShowAll = false)
    console.log('int:', win.widthRequest = 100)
    console.log('uint32:', box.borderWidth = 5)
    console.log('float:', btn.xalign = 0.75)
    console.log('double:', win.opacity = 0.89)
    console.log('enum:', win.valign = 0)
    console.log('flags:', win.events = 0)
    console.log('string:', win.title = 'test title')
    // console.log('boxed (struct):', win.window)
    // console.log('object:', win.parent)

    // console.log('ghash:', settings.colorHash = new GLib.HashTable(() => 0, () => false))
    // console.log('array:', scaleBtn.icons = ['arrow1-down', 'diamond-outline-thick'])
  })

  describe('getters', () => {
    // normal props
    console.log('bool:', isntUndefined(win.noShowAll))
    console.log('int:', isntUndefined(win.widthRequest))
    console.log('uint32:', isntUndefined(box.borderWidth))
    console.log('float:', isntUndefined(btn.xalign))
    console.log('double:', isntUndefined(win.opacity))
    console.log('enum:', isntUndefined(win.valign))
    console.log('flags:', isntUndefined(win.events))
    console.log('string:', isntUndefined(win.title))
    console.log('boxed (struct):', isntUndefined(win.window))
    console.log('object:', isntUndefined(win.parent))

    console.log('ghash:', isntUndefined(settings.colorHash))
    // console.log('array:', isntUndefined(scaleBtn.icons))
  })

  win.close()
})

win.showAll()
Gtk.main()
