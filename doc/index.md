# Documentation

**Note**: GTK and Adwaita are companion libraries: GTK is the base layer, and 
Adwaita is a set of widgets and theming that is built on top of GTK.

#### Table of contents
  1. [Importing libraries](#importing-libraries)
  1. [Using libraries](#using-libraries)
  1. [Widgets and styling](#widgets-and-styling)
  1. [Devtools](#devtools)
  1. [Typescript](#typescript)

## Importing libraries

For ESM, always run your app with `node --import node-gtk/register` to import a namespace with the `gi:` scheme:

```javascript
import Gtk from 'gi:Gtk-4.0'
             // 'gi:Name-Version'
```

Not sure which libraries (and versions) are installed? Run `node-gtk list` (or
`node-gtk list gtk` to filter) to print them.

See [importing](./importing.md) for details and CJS support.

, [styles.md](./styles.md) for the CSS helper with
development hot-reload, and [typescript.md](./typescript.md) for generating
TypeScript declarations.

## Using libraries

node-gtk converts each native library into JavaScript at runtime, so the GObject
type system shows through: classes and inheritance, properties, signals,
enums/flags, and a few C-isms like out-arguments. The
**[GObject type system guide](./gobject-introspection.md)** walks through how all
of it maps to JavaScript — read it once and GTK's C/GI docs become easy to follow.

Once you have an overview of the type system, [GTK4](https://docs.gtk.org/gtk4/) and
[Adwaita](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/) docs are your best
bet for reference (until `node-gtk` publishes its own generated documentation). In case of
need, **GJS** and **PyGObject** examples and docs also translate well.

## Widgets and styling

For a list of available widgets, see [GTK Widgets](https://docs.gtk.org/gtk4/visual_index.html) and
[Adwaita widgets](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/widget-gallery.html).

GTK CSS and classes are used for styling. It does not match completely standard CSS,
but is a close enough. `node-gtk` provides a small CSS helper for developement hot-reload, 
see [styles.md](./styles.md).

Be sure to read the [style-classes](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/style-classes.html)
and [CSS variablaes](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/css-variables.html) docs.

## Devtools

For debugging, you can start node with `--inspect` or `--inspect-brk` and use the Chromium devtools via `chrome://inspect`.

The [GTK Inspector](https://developer.gnome.org/documentation/tools/inspector.html) is also available to inspect the widget tree and styles.

![GTK Inspector](https://developer.gnome.org/documentation/_images/inspector-main-dark.png)

## Typescript

For **Typescript** integration, you need to generate typings:

```sh
npx node-gtk generate-types Gtk-4.0 Pango-1.0 [etc]
```

See  [typescript.md](./typescript.md)


## node-gtk low-level API

See [api.md](./api.md) for the low-level `node-gtk` API.