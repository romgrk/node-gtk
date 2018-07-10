# node-gtk
GNOME Gtk+ bindings for NodeJS

### What is this
A work in progress to bring Gtk+ usable directly from nodejs so that the environemnt would be more udated and supported than the one available via [GJS](https://wiki.gnome.org/action/show/Projects/Gjs).
It uses the GObject Introspection library (as PyGObject, for example), so any gobject-introspectable library is supported.

Please note this project is currently in _beta_ state and is being developped. Any contributors willing to help
will be welcomed.

Supported Node.js versions: **8**, **9**, **10** (other versions might work but are untested)

### Table of contents

- [Example](#example)
- [Documentation](#documentation)
    + [Exports](#exports)
    + [Signals (event handlers)](#signals-event-handlers)
    + [Gtk](#gtk)
    + [Naming conventions](#naming-conventions)
- [Installing and building](#installing-and-building)
  * [Target Platforms (so far)](#target-platforms-so-far)
  * [Common dependencies](#common-dependencies)
  * [How to build on Ubuntu](#how-to-build-on-ubuntu)
  * [How to build on ArchLinux](#how-to-build-on-archlinux)
  * [How to build on OSX](#how-to-build-on-osx)
  * [Experimental platforms](#experimental-platforms)
  * [Testing the project](#testing-the-project)
    + [Browser demo](#browser-demo)

## Example

```javascript
const gi = require('node-gtk')
Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()

const win = new Gtk.Window();
win.on('destroy', () => Gtk.mainQuit())
win.on('delete-event', () => false)

win.setDefaultSize(200, 80)
win.add(new Gtk.Label({ label: 'Hello Gtk+' }))

win.showAll();
```

![Hello node-gtk!](img/hello-node-gtk.png)

Check the [browser demo](https://github.com/romgrk/node-gtk/blob/master/examples/browser.js)
below for a more complete example.


## Documentation

#### Exports

This module exports a single `require` function:

```javascript
const gi = require('node-gtk')

/**
 * gi.require:
 * Loads a GIR module
 * @param {String} name - name of the module
 * @param {String} [version] - [optional] version of the module (latest by default)
 */
const Gtk = gi.require('Gtk', '3.0')
```

#### Signals (event handlers)

Signals (or events, in NodeJS semantics) are dispatched through the usual `.on`,
`.off`, and `.once` methods.

Returning `true` from an event handler can have the special semantic of stopping the event
from being propagated or preventing the default value. Refer to GTK documentation for details.
(E.g. [GtkWidget signals](https://developer.gnome.org/gtk3/stable/GtkWidget.html#GtkWidget.signals))

```javascript
const input = new Gtk.Entry()

/**
 * GObject.on - associates a callback to an event
 * @param {String} name - Name of the event
 * @param {Function} callback - Event handler
 */
input.on('key-press-event', onKeyPress)

/**
 * GObject.off - dissociates callback from an event
 * @param {String} name - Name of the event
 * @param {Function} callback - Event handler
 */
input.off('key-press-event', onKeyPress)

/**
 * GObject.once - as GObject.on, but only runs once
 * @param {String} name - Name of the event
 * @param {Function} callback - Event handler
 */
input.once('key-press-event', onKeyPress)


function onKeyPress(event) {
  // event.__proto__ === Gdk.EventKey
  console.log(event.string, event.keyval)
}
```

Low-level methods `.connect(name: String, callback: Function) : Number` and
`.disconnect(name: String, handleID: Number) : void` are also available.

#### Gtk

For GTK objects and functions documentation, please refer to [gnome documentation](https://developer.gnome.org/gtk3/stable/), or any other GIR generated documentation as [valadoc](https://valadoc.org/gtk+-3.0/index.htm).

#### Naming conventions

 - **Functions, Methods & Virtual Functions**: `lowerCamelCase`  
    Methods on GObject, structs, unions and functions on namespaces.  
    Example:  
    `GLib.randomIntRange(0, 'string')`  
    `textBuffer.placeCursor(0)`

 - **Fields & Properties**: `lowerCamelCase`  
    Fields are on structs and unions.  
    Properties are on GObjects.  
    Example:  
    `textView.showLineNumbers = true`  
    `new Gdk.Color().blue = 200`

 - **Structs, Unions, GObjects & Interfaces**: `UpperCamelCase`  
    Defined on namespaces.  
    Example:  
    `Gtk.Button`  
    `Gdk.Color`

 - **Enums, Flags**:  
    Defined on namespaces.  
    Example:  
    `Gtk.AttachOptions`  
    `Gdk.EventType`

 - **Constants & Values**: `ALL_CAPS_SNAKE_CASE`  
    Can be attached on namespaces or on specific objects.  
    Example:  
    `Gdk.KEY_g`  
    `Gdk.EventType.KEY_PRESS`

 - **Signals**: `dash-case`  
    Events triggered by GObjects.  
    Example:  
    `gtkEntry.on('key-press-event', (ev) => { ... })`


## Installing and building

### Target Platforms (so far)
We're planning to serve pre-built binaries in order to make this project as cross platform and easy to install as possible.
However, right now we support only **Linux** and experimentally **OSX** but in both targets _the project will falback to build_.
This project is tested on Node.js **8** and **10**.


### Common dependencies
In order to clone, install, and build this project you'll need a working copy of git, nodejs 8 or higher, npm, and python2.
In the _not-working-yet_ Windows platform, all dependencies must be available under [MSYS2 shell](https://msys2.github.io).


### How to build on Ubuntu

Be sure `node` is version **8** or higher.
Ignore the following step iv `node --version` is already 8 or higher.

```sh
# setup node 8
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
```

Install basic dependencies.

```sh
# install dependencies
sudo apt-get install \
  build-essential git \
  nodejs \
  gobject-introspection \
  libgirepository1.0-dev
```

At this point `npm install node-gtk` should already install, fallback and build `node-gtk` without problems.


### How to build on ArchLinux

The following should be the bare minimum to be able to build the project.

```sh
pacman -S --needed \
  base-devel git \
  nodejs npm \
  gtk3 gobject-introspection
```

Feel free to install all `base-devel` utilities.

After installing those packages, `npm install node-gtk` would do.


### How to build on OSX
Assuming you have [brew](http://brew.sh) installed, the following has been successfully tested on El Captain.

```sh
# basic dependencies to build this repo
brew install git node gtk+3
```

At this point `npm install node-gtk` should already install, fallback and build `node-gtk` without problems.


### Testing the project

If you'd like to test everything builds and work properly, find a target to clone this project, then run `npm install`.

```sh
# clone and build
git clone https://github.com/romgrk/node-gtk.git
cd node-gtk
npm install

# how to verify from node-gtk folder
./examples/hello-gtk.js
```
If you'll see a little window saying hello that's it: it works!

Please note in OSX the window doesn't automatically open above other windows.
Try Cmd + Tab if you don't see it.


#### Browser demo

If you'd like to test `./examples/browser.js` you'll need [WebKit2 GTK+](http://webkitgtk.org/) libary.

  * in **Ubuntu**, you can `apt-get install libwebkit2gtk-3.0` (`4.0`   works too) and try it out.
  * in **ArchLinux**, you can `pacman -S --needed webkitgtk` and try it out.
  * in **OSX**, there is no way to run it right now because `webkitgtk` was removed from homebrew

Once installed, you can `./examples/browser.js google.com` or any other page, and you might try the _dark theme_ out too:

```sh
# OSX needs to have the Adwaita theme installed
# brew install adwaita-icon-theme

# executable          url         theme
./examples/browser.js google.com  dark
```


### Experimental platforms

Following how to setup the configuration to at least try building this project.


#### How to build on Windows (experimental)
Mandatory dependency is _[Visual Studio Community](https://www.visualstudio.com/en-us/products/visual-studio-community-vs.aspx)_ or _Express_ with a C++ compiler (open a new C++ project and install it via IDE if necessary).

The easiest/tested way to at least try building this repository is within a _MinGW shell_ provided by the [MSYS2 installer](https://msys2.github.io/).

Once VS and its C++ compiler is available and MSYS2 installed, launch the MinGW shell.

```sh
# update the system
# in case of errors, wait for the update to complete
# then close and open again MingW shell
pacman -Syyu --noconfirm

# install git, gtk3 and extra dependencie
pacman -S --needed --noconfirm git mingw-w64-$(uname -m)-{gtk3,gobject-introspection,pkg-config}

# where to put the repository clone?
# pick your flder or use ~/oss (Open Source Software)
mkdir -p ~/oss/
cd ~/oss

# clone node-gtk there
git clone https://github.com/romgrk/node-gtk
cd node-gtk

# first run might take a while
GYP_MSVS_VERSION=2015 npm install
```
The `GYP_MSVS_VERSION` could be 2010, 2012, 2013 or 2015.
Please verify [which version you should use](https://github.com/nodejs/node-gyp#installation)


#### Possible issue on MinGW shell
In case you are launching the general executable without knowing the correct platform,
the binary path might not be available.

In such case `python` won't be available neither, and you can check via `which python` command.

If not found, you need to export the platform related binary path:

```sh
# example for the 32bit version
export PATH="/mingw32/bin:$PATH"
npm run install
```

This should do the trick. You can also check if there is any python at all via `pacman -Qs python`.

Please remember `python2` is the one needed.


#### known issues building on Windows
Right now there are few gotchas and the build will most likely fail. Please help with a PR if you know how to solve the issue, thank you!
