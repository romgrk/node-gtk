/*
 * object_get.js
 */

const gi = require('../lib')
const GLib = gi.require('GLib', '2.0')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const { describe, it, expect, assert, isntUndefined } = require('./__common__.js')

gi.startLoop()
Gtk.init()
Gdk.init([])

let color = new Gdk.RGBA({ red: 0.5 })

let win = new Gtk.Window()
let box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
let btn = new Gtk.Button()
let colorBtn = new Gtk.ColorButton()
let scaleBtn = new Gtk.ScaleButton()
let entry = new Gtk.Entry()
let settings = Gtk.Settings.getDefault()

box.add(btn)
box.add(colorBtn)
box.add(entry)
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
    console.log('enum:', win.valign = 1)
    console.log('flags:', entry.inputHints = Gtk.InputHints.LOWERCASE)
    console.log('string:', win.title = 'test title')
    console.log('boxed (struct):', colorBtn.rgba = color)
    // console.log('object:', win.parent)

    // console.log('ghash:', settings.colorHash = new GLib.HashTable(() => 0, () => false))
    // console.log('array:', scaleBtn.icons = ['arrow1-down', 'diamond-outline-thick'])
  })

  describe('getters', () => {
    // normal props
    console.log('bool:',           expect(win.noShowAll, false))
    console.log('int:',            expect(win.widthRequest, 100))
    console.log('uint32:',         expect(box.borderWidth, 5))
    console.log('float:',          expect(btn.xalign, 0.75))
    console.log('double:',         expect(win.opacity.toFixed(2), '0.89'))
    console.log('enum:',           expect(win.valign, 1))
    console.log('flags:',          expect(entry.inputHints, Gtk.InputHints.LOWERCASE))
    console.log('string:',         expect(win.title, 'test title'))
    console.log('boxed (struct):', expect(colorBtn.rgba.toString(), color.toString()))
    console.log('object:',         isntUndefined(win.parent))

    console.log('ghash:',          isntUndefined(settings.colorHash))
    // console.log('array:', isntUndefined(scaleBtn.icons))
  })

  win.close()
})

win.showAll()
Gtk.main()
