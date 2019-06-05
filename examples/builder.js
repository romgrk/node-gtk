const gi = require('../lib/index');
const Path   = require('path');
gi.startLoop()

const Gdk          = gi.require('Gdk', '3.0');
const Gtk          = gi.require('Gtk', '3.0');

Gtk.init()

const gladeFile = Path.join(__dirname, 'builderExample.glade');
const builder = Gtk.Builder.newFromFile(gladeFile);
const win = builder.getObject('mainWindow');
win.__proto__ = Gtk.Window.prototype

win.setDefaultSize(600, 800);
win.on('show', Gtk.main);

const button = builder.getObject('closeButton');
button.__proto__ = Gtk.Button.prototype
button.on('clicked', Gtk.mainQuit);

const label = builder.getObject('helloLabel');
label.__proto__ = Gtk.Label.prototype
label.setText('Hello World!');

win.showAll();
