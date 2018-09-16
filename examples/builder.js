const gi = require('../lib/index');
gi.startLoop()

const Gdk          = gi.require('Gdk', '3.0');
const Gtk          = gi.require('Gtk', '3.0');

Gtk.init()

const builder = Gtk.Builder.newFromFile('./builderExample.glade');
const win = builder.getObject('mainWindow');

win.setDefaultSize(600, 800);
win.on('show', Gtk.main);

const button = builder.getObject('closeButton');
button.on('clicked', Gtk.mainQuit);

const label = builder.getObject('helloLabel');
label.setText('Hello World!');

win.showAll();
