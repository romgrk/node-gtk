/*
 * object_get.js
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */

function log (label, obj) {
    console.log(label, require('util').inspect(obj, {colors: true}));
}

var gi = require('node-gtk');

Gtk = gi.require('Gtk', '3.0');
Gtk.init(null, 0);

var win = new Gtk.Window();

log('win: ', win);
log('win.title: ', win.title);
