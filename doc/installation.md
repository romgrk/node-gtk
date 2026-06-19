# Installing & building

Note that prebuilt binaries are available for common systems, in those cases building is not necessary.

### Table of contents

- [Target Platforms](#target-platforms)
- [Requirements](#requirements)
- [How to build on Ubuntu](#how-to-build-on-ubuntu)
- [How to build on Fedora](#how-to-build-on-fedora)
- [How to build on ArchLinux](#how-to-build-on-archlinux)
- [How to build on macOS](#how-to-build-on-macos)
- [How to build on Windows](#how-to-build-on-windows)
- [Testing the project](#testing-the-project)
  - [Unit tests](#unit-tests)
  - [Browser demo](#browser-demo)

##### Target Platforms

- **Linux**: prebuilt binaries available
- **macOS**: prebuilt binaries available
- **Windows**: prebuilt binaries available (the GTK4/Adwaita runtime is bundled
  with the binary, so no MSYS2/compiler is needed to *use* node-gtk; the terminal
  widget Vte is the one exception — it has no Windows port). Building from source
  still requires MSYS2 (see below).

### Requirements

- `git`
- `python3` (for `node-gyp`)
- (depending on your system) C compiler (`gcc@8` or higher, or `clang`)

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
  nodejs-devel \
  gobject-introspection \
  gobject-introspection-devel \
  gtk3 \
  gtk3-devel \
  cairo \
  cairo-devel
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

### How to build on Windows

Mandatory dependency is Visual C++ Build Environment: Visual Studio Build Tools (using "Visual C++ build tools" workload) or Visual Studio Community (using the "Desktop development with C++" workload).

The easiest/tested way to build this repository is within a _MinGW shell_ provided by the [MSYS2 installer](https://msys2.github.io/).

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

# don't include /mingw64/include directly since it conflicts with
# Windows SDK headers. we copy needed headers to __extra__ directory:
./windows/mingw_include_extra.sh

# if MSYS2 is NOT installed in C:/msys64 run:
export MINGW_WINDOWS_PATH=$(./windows/mingw_windows_path.sh)

# first run might take a while
GYP_MSVS_VERSION=2017 npm install
```

The `GYP_MSVS_VERSION` could be 2017 or above.
Please verify [which version you should use](https://github.com/nodejs/node-gyp#installation)

The below blog post series will help you get started:

1. [Node.js GTK Hello World on Windows](https://ten0s.github.io/blog/2022/07/22/nodejs-gtk-hello-world-on-windows)
2. [Find DLLs and Typelibs dependencies for Node.js GTK Application on Windows](https://ten0s.github.io/blog/2022/07/25/find-dlls-and-typelibs-dependencies-for-nodejs-gtk-application-on-windows)
3. [Package Node.js GTK Application on Windows](https://ten0s.github.io/blog/2022/07/27/package-nodejs-gtk-application-on-windows)

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

### Testing the project

If you'd like to test everything builds and work properly, after installing and building you can run any of the
examples:

```sh
node ./examples/hello-world.js
```

If you'll see a little window saying hello that's it: it works!

Please note in macOS the window doesn't automatically open above other windows.
Try <kbd>Cmd</kbd> + <kbd>Tab</kbd> if you don't see it.

#### Unit tests

Run the test suite with:

```sh
npm test
```

The suite includes `marshalling__*.js` and `regress__*.js` tests that exercise
node-gtk's type conversions (in/out/inout/return for every GObject type) against
the GObject-introspection test libraries — **GIMarshallingTests**, **Regress**,
and **Utility**.

Those libraries are provided by `scripts/build-test-fixtures.js`, which runs
automatically before `npm test`. To keep the API identical on every machine, it
always compiles them from a single pinned revision of the upstream
[`gobject-introspection-tests`](https://gitlab.gnome.org/GNOME/gobject-introspection-tests)
repo (downloaded once and cached), rather than relying on whatever version a
distro happens to ship. It needs `g-ir-scanner`/`g-ir-compiler`, a C compiler,
cairo dev headers, and `curl`/`tar`; if any are missing the marshalling tests
skip rather than fail. The generated fixtures live in `tests/gi-fixtures/`
(git-ignored). To bump the upstream revision, change `SOURCE_REF` in the script.
To (re)build manually:

```sh
npm run build:test-fixtures                            # build if missing
node scripts/build-test-fixtures.js --force --verbose  # force a fresh rebuild
```

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
