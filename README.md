# node-gtk
GNOME Gtk+ bindings for NodeJS

### What is this
A work in progress to bring Gtk+ usable directly from nodejs so that the environemnt would be more udated and supported than the one available via [GJS](https://wiki.gnome.org/action/show/Projects/Gjs).

Please note this project is currently in an _alpha_ state and it needs more contributors.


### How to build on OSX
Assuming you have [brew]() installed, the following has been successfully tested on El Captain.

```sh
# basic dependencies to clone this repo
brew install git node


# Gtk+
brew install gtk+3


# in order to test this project localy
git clone https://github.com/WebReflection/node-gtk
cd node-gtk


# in order to build it successfully (this is one line command)
# feel free to ignore ignore possible warnings
PKG_CONFIG_PATH="$(brew --prefix libffi)/lib/pkgconfig" \
CXX="$(which g++) $(pkg-config --cflags glib-2.0 gobject-introspection-1.0 --libs gobject-introspection-1.0)" \
npm run install


# in order to test it
./examples/hello-gtk.js
```
Please note in OSX the window doesn't automatically open above other windows.
Try Cmd + Tab if you don't see it.


### How to build on Linux

The main dependency in linux too is `gtk3` and possibly `gobject-introspection`.

A simple `npm install` after cloning this project should be enough to build it.


### How to build in Ubuntu 15.10
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

#### How to install node 5.x in Ubuntu 16 LTS
The setup file might not recognize `xenial` platform.
In this case you need to download the file and edit it.

```bash
# download the file
curl -L -O https://deb.nodesource.com/setup_5.x

# edit (use vi or gedit or whatever you like) 
gedit setup_5.x

# find the following line
DISTRO=$(lsb_release -c -s)
# and change it to
DISTRO=jessie


# save the file and run the following
cat setup_5.x | sudo -E bash -

# once done you can
rm setup_5.x
```

At this point you can `apt-get install nodejs`