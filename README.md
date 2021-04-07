<p align="center">
    <a>
      <img
        alt="NODE-GTK"
        width="250"
        src="https://raw.githubusercontent.com/romgrk/node-gtk/master/img/node-gtk-logo.svg?sanitize=true"
      />
    </a>
</p>

<h1 align="center">node-gtk</h1>
<p align="center">
  <b>GNOME Gtk+ bindings for NodeJS</b>
  <br/>
  <img src="https://img.shields.io/npm/v/node-gtk" alt="Package Version" />
</p>

Node-Gtk is a [gobject-introspection](https://gi.readthedocs.io/en/latest) library for nodejs. It makes it possible to
use any introspected library, such as Gtk+, usable.  It is similar in essence to [GJS](https://wiki.gnome.org/action/show/Projects/Gjs) or [PyGObject](https://pygobject.readthedocs.io). Please note this project is currently in a _beta_ state and is being developed. Any contributors willing to help
will be welcomed.

Supported Node.js versions: **12**, **14**, **15** (other versions should work but are untested)  
Pre-built binaries available for: **Linux**, **macOS**

### Table of contents

- [Usage](#usage)
- [Documentation](#documentation)
- [Installing and building](#installing-and-building)
  - [Target Platforms](#target-platforms)
  - [Requirements](#requirements)
  - [How to build on Ubuntu](#how-to-build-on-ubuntu)
  - [How to build on Fedora](#how-to-build-on-fedora)
  - [How to build on ArchLinux](#how-to-build-on-archlinux)
  - [How to build on macOS](#how-to-build-on-osx)
  - [Experimental platforms](#experimental-platforms)
  - [Testing the project](#testing-the-project)
    - [Browser demo](#browser-demo)
- [Contributing](#contributing)

## Usage

Below is a minimal example of how to use the code, but take a look at
our [template](https://github.com/romgrk/node-gtk-template) or at
[react-gtk](https://github.com/codejamninja/react-gtk) to bootstrap your
project.

```javascript
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()

const win = new Gtk.Window()
win.on('destroy', () => Gtk.mainQuit())
win.on('delete-event', () => false)

win.setDefaultSize(200, 80)
win.add(new Gtk.Label({ label: 'Hello Gtk+' }))

win.showAll()
Gtk.main()
```

<p align="center">
  <img src="./img/hello-node-gtk.png" alt="Hello Gtk" style="width: 220px; height: auto;"/>
</p>

See our [examples](./examples) folder for more examples, and in particular the
[browser demo source](https://github.com/romgrk/node-gtk/blob/master/examples/browser.js) for
a more complex application.

<p align="center">
  <img src="./img/browser.png" alt="Hello Gtk" style="max-width: 500px; height: auto;"/>
</p>


## Documentation

[Read our documentation here](./doc/index.md)

## Installing and building

Note that prebuilt binaries are available for common systems, in those cases building is not necessary.

##### Target Platforms

 - **Linux**: prebuilt binaries available
 - **macOS**: prebuilt binaries available
 - **Windows**: unsupported for now ([#241](https://github.com/romgrk/node-gtk/issues/241))

### Requirements

 - `git`
 - `nodejs@10` or higher
 - `python2` (for `node-gyp`)
 - C compiler (`gcc@8` or higher, or `clang`)

In the _not-working-yet_ Windows platform, all dependencies must be available under [MSYS2 shell](https://msys2.github.io).

### How to build on Ubuntu

Install basic dependencies.

```sh
sudo apt-get install \
  build-essential git \
  gobject-introspection \
  libgirepository1.0-dev \
  libcairo2 \
  libcairo2-dev
```

At this point `npm install node-gtk` should already install, fallback and build `node-gtk` without problems.

### How to build on Fedora

Install basic dependencies:

```sh
sudo dnf install \
  @development-tools \
  nodejs \
  gobject-introspection \
  gtk3 \
  cairo
```

After installing of packages, run `npm install node-gtk`.

### How to build on ArchLinux

The following should be the bare minimum to be able to build the project.

```sh
pacman -S --needed \
  base-devel git \
  nodejs npm \
  gtk3 gobject-introspection \
  cairo
```

Feel free to install all `base-devel` utilities.

After installing those packages, `npm install node-gtk` would do.

### How to build on macOS

Assuming you have [brew](http://brew.sh) installed, the following has been successfully tested on El Captain.

```sh
brew install git node gobject-introspection gtk+3 cairo
```

At this point `npm install node-gtk` should already install, fallback and build `node-gtk` without problems.

### Testing the project

If you'd like to test everything builds and work properly, after installing and building you can run any of the
examples:

```sh
node ./examples/hello-gtk.js
```

If you'll see a little window saying hello that's it: it works!

Please note in macOS the window doesn't automatically open above other windows.
Try <kbd>Cmd</kbd> + <kbd>Tab</kbd> if you don't see it.

#### Browser demo

If you'd like to test `./examples/browser.js` you'll need [WebKit2 GTK+](http://webkitgtk.org/) libary.

- in **Ubuntu**, you can `apt-get install libwebkit2gtk-3.0` (`4.0` works too) and try it out.
- in **Fedora**, you should run `sudo dnf install webkit2gtk3`
- in **ArchLinux**, you can `pacman -S --needed webkitgtk` and try it out.
- in **macOS**, there is no way to run it right now because `webkitgtk` was removed from homebrew

Once installed, you can `./examples/browser.js google.com` or any other page, and you might try the _dark theme_ out too:

```sh
# macOS needs to have the Adwaita theme installed
# brew install adwaita-icon-theme

# Usage: ./examples/browser.js <url> [theme]
./examples/browser.js  google.com  dark
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
pacman -S --needed --noconfirm git mingw-w64-$(uname -m)-{gtk3,gobject-introspection,pkg-config,cairo}

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

In such case `python` won't be available either, and you can check via `which python` command.

If not found, you need to export the platform related binary path:

```sh
# example for the 32bit version
export PATH="/mingw32/bin:$PATH"
npm run install
```

This should do the trick. You can also check if there is any python at all via `pacman -Qs python`.

Please remember `python2` is the one needed.

#### Known issues building on Windows

Right now there are few gotchas and the build will most likely fail. Please help with a PR if you know how to solve the issue, thank you!

## Contributing

If you'd like to help, we'd be more than happy to have support. To setup your development environment, you can
run `npm run configure`. You can then build the project with `npm run build`.

 - https://developer.gnome.org/gi/stable/index.html
 - https://v8docs.nodesource.com/
 - https://github.com/nodejs/nan#api

Don't hesitate to join our [Discord channel](https://discord.gg/r2VqPUV).

### Contributors

 - [magcius](https://github.com/magcius)
 - [WebReflection](https://github.com/WebReflection)
 - [romgrk](https://github.com/romgrk)
 - [wotzlaff](https://github.com/wotzlaff)
