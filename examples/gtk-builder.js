/*
 * gtk-builder.js
 *
 * Adapted to node-gir from the C version :
 * https://github.com/GNOME/gtk/blob/master/examples/builder.c
 */

const path = require('path')
const gi = require('../')
const Gtk = gi.require('Gtk')

// Construct a GtkBuilder instance and load our UI description.
const builder = new Gtk.Builder();
builder.addFromFile(path.join(__dirname, 'builder.ui'));

// Connect signal handlers to the constructed widgets.
const win = builder.getObject('window');
win.connect('destroy', () => {
    Gtk.mainQuit();
})
const button1 = builder.getObject('button1');
button1.connect('clicked', () => {
    console.log('Hello World');
})

const button2 = builder.getObject('button2');
button2.connect('clicked', () => {
    console.log('Hello World');
})

const quitButton = builder.getObject('quit');
quitButton.connect('clicked', () => {
    Gtk.mainQuit();
})

Gtk.main();
