/*
 * gtk_text_buffer_place_cursor.js
 */

// common.skip()

const gi = require('../');

const Gtk = gi.require('Gtk');
const GtkSource = gi.require('GtkSource', '3.0')
const common = require('./__common__.js')

Gtk.init()


const textView = new GtkSource.View()
const buffer = textView.getBuffer()

const iter = buffer.getEndIter()

buffer.placeCursor(iter)
