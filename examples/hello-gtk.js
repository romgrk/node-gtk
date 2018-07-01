#!/usr/bin/env node

const GNode = require('../lib/')
const Gtk = GNode.require('Gtk')

GNode.startLoop()
Gtk.init()


const settings = Gtk.Settings.getDefault()
settings.gtkApplicationPreferDarkTheme = true;
settings.gtkThemeName = 'Adwaita';

console.log(settings.gtkEnableAccels);


const win = new Gtk.Window({
  title: 'node-gtk',
  window_position: Gtk.WindowPosition.CENTER
});

win.connect('show', Gtk.main);
win.connect('destroy', Gtk.mainQuit);
win.setDefaultSize(200, 80);
win.add(new Gtk.Label({label: 'Hello Gtk+'}));
win.showAll();
