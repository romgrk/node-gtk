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
npm install


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

### How to build on Windows (experimental)
Mandatory dependency is _[Visual Studio Community](https://www.visualstudio.com/en-us/products/visual-studio-community-vs.aspx)_ or _Express_ with a C++ compiler (open a new C++ project and install it via IDE if necessary).

The easiest/tested way to at least try building this repository is within a _MinGW shell_ provided by the [MSYS2 installer](https://msys2.github.io/).

Once VS and its C++ compiler is available and MSYS2 installed, launch the MinGW shell.

```sh
# update the system
# in case of errors, wait for the update to complete
# then close and open again MingW shell
pacman -Syyu --noconfirm

# install gtk3 and basic dependencies
pacman -S --needed --noconfirm git mingw-w64-$(uname -m)-{gtk3,gobject-introspection,pkg-config}

# where to put the repository clone?
# pick your flder or use ~/oss (Open Source Software)
mkdir -p ~/oss/
cd ~/oss

# clone node-gtk there
git clone https://github.com/WebReflection/node-gtk
cd node-gtk

# first run might take a while
GYP_MSVS_VERSION=2015 npm install
```
The `GYP_MSVS_VERSION` could be 2010, 2012, 2013 or 2015.
Please verify [which version you should use](https://github.com/nodejs/node-gyp#installation)

#### known issues building on Windows
Right now there are few gotchas and the build will most likely fail. Please help with a PR if you know how to solve the issue, thank you!
