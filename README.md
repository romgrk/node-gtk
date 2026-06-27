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
  <b>GTK bindings for NodeJS</b>
  <br/>
  <img src="https://img.shields.io/npm/v/node-gtk" alt="Package Version" />
</p>

`node-gtk` is a [gobject-introspection](https://gi.readthedocs.io/en/latest) library 
for nodejs. It makes it possible to use any introspected C library, such as GTK, 
usable. It is similar in essence to [GJS](https://wiki.gnome.org/action/show/Projects/Gjs) 
or [PyGObject](https://pygobject.readthedocs.io). Please note this project is 
currently in a _alpha_ state.

Supported Node.js versions: **20**, **22**, **24** (other versions may work but are untested)<br>
Supported platforms:
- **Linux** — prebuilt binaries available
- **macOS** — prebuilt binaries available
- **Windows** — prebuilt binaries available (but read [Windows](#windows))


### Table of contents

- [Usage](#usage)
- [ES modules](#es-modules)
- [Documentation](#documentation)
- [TypeScript](#typescript)
- [Installing](#installing)
- [Contributing](#contributing)

## Usage

Below is a [minimal example](./examples/hello-world.mjs) of how to use node-gtk.
Namespaces are imported with the `gi:` scheme; run your app with
`node --import node-gtk/register`:

```sh
node --import node-gtk/register app.mjs
```

```javascript
// app.mjs
import GLib from 'gi:GLib-2.0'   // `gi:Name-Version` (or `gi:Name` for the latest)
import Gtk from 'gi:Gtk-4.0'
import Adw from 'gi:Adw-1'

const loop = GLib.MainLoop.new(null, false)
const app = new Adw.Application('com.github.romgrk.node-gtk.hello', 0)

app.on('activate', () => {
  const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  content.append(new Adw.HeaderBar())
  content.append(new Gtk.Label({ label: 'Hello Adwaita!', vexpand: true }))

  const window = new Adw.ApplicationWindow(app)
  window.setTitle('node-gtk')
  window.setDefaultSize(300, 120)
  window.setContent(content)
  window.on('close-request', () => (loop.quit(), app.quit(), false))
  window.present()

  loop.run()
})

// Under ESM the run call returns immediately; the app keeps running and the
// process exits when the window is closed. See "ES modules" below.
app.run([])
```

> Prefer CommonJS? node-gtk supports it too — see the
> [importing guide](./doc/importing.md#commonjs).

<p align="center">
  <img src="./img/hello-world.png" style="width: 290px; height: auto;"/>
</p>

### Scaffold a new app

To start a new GTK/Adwaita project from scratch, run:

```sh
npx node-gtk init my-app
cd my-app
npm run dev
```

This generates a ready-to-run, TypeScript + ESM Adwaita application — an
`Adw.Application` with a header bar, a primary menu, an About window, and live
reload — and wires up `generate-types` so the GI APIs are fully typed. See
[`tools/README.md`](./tools/README.md#node-gtk-init--scaffold-a-new-app) for the
available options.

You can also easily create custom applications:

[A web browser (using WebKit2GTK)](./examples/browser.mjs)

<p align="center">
  <img src="./img/browser.png" style="max-width: 500px; height: auto;"/>
</p>

[A system monitor](./examples/system-monitor.mjs)

<p align="center">
  <img src="./img/system-monitor.png" style="width: 400px; height: auto;"/>
</p>

## ES modules

ES modules are the default (see [Usage](#usage)): namespaces are imported with the
`gi:` scheme (`import Gtk from 'gi:Gtk-4.0'`) after installing the hooks with
`node --import node-gtk/register`, and the loop integration starts automatically.

One thing to know up front: under ESM, blocking main-loop calls (`loop.run()`,
`app.run()`, `Gtk.main()`) **return immediately** instead of blocking, and don't
return a value — so make the run call the last statement and do cleanup/exit from
your handler:

```javascript
app.on('activate', () => {
  // ...build the window...
  window.on('close-request', () => (loop.quit(), app.quit(), false))
  window.present()

  loop.run()       // returns immediately under ESM; do cleanup/exit in the handler
})

app.run([])        // not `process.exit(app.run([]))` — the return value is unavailable
```

See the **[importing guide](./doc/importing.md)** for the full details: the `gi:`
scheme, importing node-gtk's own API, skipping the `--import` flag, and CommonJS.
For the why behind the immediate-return behaviour, see
[#449](https://github.com/romgrk/node-gtk/issues/449).

## Documentation

[Read our documentation here](./doc/index.md)

## TypeScript

node-gtk can generate TypeScript declarations for the libraries you use,
straight from the GObject-Introspection typelibs installed on your machine — so
the types always match your actual library versions and node-gtk's own runtime
shape (camelCase methods, signal callbacks, nullability, etc.).

```sh
# generates ./node_modules/.node-gtk-types (a hidden, git-ignored cache)
npx node-gtk generate-types Gtk-4.0 Adw-1
```

The command emits one declaration file per namespace (plus the full dependency
closure) and a `node-gtk.d.ts` shim. Point your `tsconfig.json` at it:

```jsonc
{
  "compilerOptions": {
    "moduleResolution": "node16",
    "paths": { "node-gtk": ["./node_modules/.node-gtk-types/node-gtk.d.ts"] }
  }
}
```

Then `gi.require` is fully typed — the namespace is inferred from the string
arguments:

```ts
import * as gi from 'node-gtk'

const Gtk = gi.require('Gtk', '4.0')   // typed as the Gtk-4.0 namespace
const win = new Gtk.ApplicationWindow({ title: 'Hello', defaultWidth: 400 })
win.on('close-request', () => false)   // signal name + callback are typed
```

The [direct `gi:` import form](./doc/importing.md#es-modules) is typed too — the generated
shim declares each `gi:<Namespace>-<version>` module, so its default export is the
namespace:

```ts
import Gtk from 'gi:Gtk-4.0'           // typed as the Gtk-4.0 namespace
const win = new Gtk.ApplicationWindow({ title: 'Hello', defaultWidth: 400 })
```

You get typed constructor properties (including inherited and interface ones),
camelCase methods with real return types, GI nullability, typed signal
overloads, enums, `bigint` for 64-bit integers, out-parameters surfaced as the
return value, and cross-namespace types. GNOME's API documentation is included
as JSDoc (with `@param`/`@returns`), so editors show it on hover — this reads the
`.gir` files installed by the libraries' `-dev`/`-devel` packages; pass
`--no-docs` for leaner output if they aren't installed or you don't want them.

Because the output is a generated cache under `node_modules`, add a `postinstall`
script so it regenerates on install:

```json
{ "scripts": { "postinstall": "node-gtk generate-types Gtk-4.0 Adw-1" } }
```

Run `npx node-gtk generate-types --help` for options.

## Installing

1. Install `node-gtk` itself
2. Install the native libraries you use (see examples per platform below)

```sh
npm install node-gtk

# This installs a prebuilt binary when one is available for your platform and
# Node.js version, otherwise it falls back to building from source.
```

#### Linux

```sh
# archlinux
pacman -S gtk4

# ubuntu
apt install libgtk-4-1
```

#### macOS

```sh
brew install gtk4
```

#### Windows

Windows doesn't have the dependencies we need in a package manager, therefore 
`node-gtk` ships prebuilt versions of GTK 4 / Adwaita runtime (DLLs, typelibs, 
icons), so `npm install node-gtk` is all you need **if** your dependency is in 
our [list of prebuilt libraries](./windows/runtime-libraries.txt).

### build from source

Building from source, or contributing? See [Building from source](./doc/building.md).

## Contributing

If you'd like to help, we'd be more than happy to have support. To setup your development environment, you can
run `npm run configure`. You can then build the project with `npm run build`. To generate the `compile_commands.json`
for LSP to work nicely, you can use [bear](https://github.com/rizsotto/Bear) as `bear -- npm run build`.

- https://developer.gnome.org/gi/stable/index.html
- https://v8docs.nodesource.com/
- https://github.com/nodejs/nan#api
