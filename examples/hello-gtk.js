#!/usr/bin/env node

var
  GNode = require('../lib/'),
  Gtk = GNode.importNS('Gtk'),
  settings,
  win
;

GNode.startLoop();
Gtk.init(null);

settings = Gtk.Settings.get_default(),
settings.gtk_application_prefer_dark_theme = true;
settings.gtk_theme_name = "Adwaita";

console.log(settings.gtk_enable_accels);

win = new Gtk.Window({
  title: 'node-gtk',
  window_position: Gtk.WindowPosition.CENTER
});

win.connect('show', Gtk.main);
win.connect('destroy', Gtk.main_quit);

win.set_default_size(200, 80);
win.add(new Gtk.Label({label: 'Hello Gtk+'}));

win.show_all();
