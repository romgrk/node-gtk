#!/usr/bin/env node

var
  GNode = require('../lib/'),
  Gtk = GNode.importNS('Gtk'),
  win
;

GNode.startLoop();
Gtk.init(null);

console.log(Gtk.Settings.get_default().gtk_enable_accels);

win = new Gtk.Window({
  title: 'node-gtk',
  window_position: Gtk.WindowPosition.CENTER
});

win.connect('show', Gtk.main);
win.connect('destroy', Gtk.main_quit);

win.set_default_size(200, 80);
win.add(new Gtk.Label({label: 'Hello Gtk+'}));

win.show_all();
