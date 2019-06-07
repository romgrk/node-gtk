const gi = require('../lib/index');
const Path   = require('path');
gi.startLoop()

const Gdk          = gi.require('Gdk', '3.0');
const Gtk          = gi.require('Gtk', '3.0');

Gtk.init()

const gladeFile = Path.join(__dirname, 'builderExample.glade');
const builder = Gtk.Builder.newFromFile(gladeFile);
const win = builder.getObject('mainWindow');

win.setDefaultSize(600, 800);
win.on('show', Gtk.main);
win.on('destroy', Gtk.mainQuit)

const button = builder.getObject('closeButton');
button.on('clicked', () => win.close())

const label = builder.getObject('helloLabel');
label.setText('Hello World!');

win.showAll();
