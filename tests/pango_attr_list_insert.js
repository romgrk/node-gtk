/*
 * pango_attr_list_insert.js
 */

const gi = require('../');
const Gtk = gi.require('Gtk');
const Pango = gi.require('Pango');
const common = require('./__common__.js')

Gtk.init()

const label = new Gtk.Label({ label: 0 })
const attrs = new Pango.AttrList()
const attrSize = new Pango.AttrSize()
attrSize.size = 300
attrs.insert(attrSize)
label.attributes = attrs
