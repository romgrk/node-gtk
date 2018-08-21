/*
 * pango_attr_list_insert.js
 */

const gi = require('../');

gi.prependLibraryPath('/home/romgrk/github/pango/pango/.libs')
gi.prependSearchPath('/home/romgrk/github/pango/pango/')

const Gtk = gi.require('Gtk');
const Pango = gi.require('Pango');
const common = require('./__common__.js')

Gtk.init()


// common.skip()


const label = new Gtk.Label({ label: 0 })

console.log('List:')
const attrs = new Pango.AttrList()

console.log('Size:')
const attrSize = new Pango.AttrSize()

attrSize.size = 300
attrs.insert(attrSize)

label.attributes = attrs
