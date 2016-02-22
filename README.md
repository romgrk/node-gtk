# node-gtk
GNOME Gtk+ bindings for NodeJS

### What is this
A work in progress to bring Gtk+ usable directly from nodejs so that the environemnt would be more udated and supported than the one available via [GJS](https://wiki.gnome.org/action/show/Projects/Gjs).

Please note this project is currently in an _alpha_ state and it needs more contributors.


### How to install
Currently, Linux is the main target but we are working to make this work on OSX too.

If you have installed `gtk3` you should be already OK and off via `npm install node-gtk`

Once installed, you can import various namespaces as following:
```js
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
```


### How to build in Ubuntu
The following has been tested on Ubuntu 15.10.
```bash
# setup node v5
curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -

# install dependencies
sudo apt-get install \
  build-essential \
  git \
  nodejs \
  gobject-introspection \
  libgirepository1.0-dev

# clone and build
git clone https://github.com/WebReflection/node-gtk.git
cd node-gtk
npm install

# how to verify from node-gtk folder
./examples/hello-gtk.js
```