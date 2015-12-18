#!/usr/bin/env node

var
  GNode = require('node-gtk'),
  Gtk = GNode.importNS('Gtk'),
  win
;

GNode.startLoop();
Gtk.init(0, null);

win = new Gtk.Window({
  title: 'node-gtk',
  window_position: Gtk.WindowPosition.CENTER
});

win.connect('show', Gtk.main);
win.connect('destroy', Gtk.main_quit);

win.set_default_size(200, 80);
win.add(new Gtk.Label({label: 'Hello Gtk+'}));

win.show_all();