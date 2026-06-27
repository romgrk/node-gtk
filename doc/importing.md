# Importing libraries

node-gtk loads GObject-Introspection namespaces (GTK, GLib, Adwaita, …) at
runtime. This page covers how to import them under both ES modules (the default)
and CommonJS.

## ES modules

Install node-gtk's loader hooks by running your app with
`node --import node-gtk/register`, then import any namespace with the `gi:`
scheme:

```sh
node --import node-gtk/register app.mjs
```

```javascript
import GLib from 'gi:GLib-2.0'   // `gi:Name-Version`, or `gi:Name` for the latest
import Gtk from 'gi:Gtk-4.0'
import Adw from 'gi:Adw-1'
```

`import Gtk from 'gi:Gtk-4.0'` is equivalent to `gi.require('Gtk', '4.0')`. The
**default export is the namespace object**, so read members off it:

```javascript
import Gtk from 'gi:Gtk-4.0'
const { Box, Label } = Gtk
```

Static named imports (`import { Box } from 'gi:Gtk-4.0'`) are **not** supported —
destructure from the default export instead.

node-gtk's own API (`registerClass`, `require`, …) is imported from the `node-gtk`
package by name:

```javascript
import gi, { registerClass } from 'node-gtk'
```

The `gi:` hooks require **Node ≥ 20.6** (for `module.register`).

### The loop integration starts automatically

The first time you run a main loop (`GLib.MainLoop.run`,
`Gio`/`Gtk.Application.run`, `Gtk.main`), node-gtk integrates it with Node's event
loop for you — there is nothing to call to enable it.

### Blocking main-loop calls return immediately

Under ESM, those same run calls **return immediately** instead of blocking, and
**don't return a value** — so make the run call the last statement and do
cleanup/exit from your handler:

```javascript
app.on('activate', () => {
  // ...build the window...
  window.on('close-request', () => (loop.quit(), app.quit(), false))
  window.present()

  loop.run()       // returns immediately under ESM; do cleanup/exit in the handler
})

app.run([])        // not `process.exit(app.run([]))` — the return value is unavailable
```

CommonJS (and signal callbacks) are unaffected. For the why and the design
trade-off, see [#449](https://github.com/romgrk/node-gtk/issues/449).

### Skipping the `--import` flag

The flag is only required for a **static** `import … from 'gi:…'` in the file you
run directly: ESM resolves the whole static graph before any code executes, so the
hooks must be installed first. You can avoid it in a few ways:

```javascript
// 1) Register programmatically, then use dynamic import (no flag):
import 'node-gtk/register'
const Gtk = (await import('gi:Gtk-4.0')).default

// 2) Tiny bootstrap entry — register, then load the real app, which is free to
//    use static `import … from 'gi:…'` (it loads after registration):
import 'node-gtk/register'
await import('./app.mjs')
```

Or move the flag into the environment instead of the command line:
`NODE_OPTIONS="--import node-gtk/register" node app.mjs` (e.g. in an npm script).

## CommonJS

node-gtk works under CommonJS too. Load namespaces with `gi.require(name, version)`
instead of `gi:` imports — the rest of the API is identical, and you run it with
plain `node app.js` (no `--import` flag):

```javascript
const gi = require('node-gtk')
const GLib = gi.require('GLib', '2.0')
const Gtk = gi.require('Gtk', '4.0')
const Adw = gi.require('Adw', '1')

const loop = GLib.MainLoop.new(null, false)
const app = new Adw.Application('com.github.romgrk.node-gtk.hello', 0)

app.on('activate', () => {
  const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  content.append(new Adw.HeaderBar())
  content.append(new Gtk.Label({ label: 'Hello Adwaita!', vexpand: true }))

  const window = new Adw.ApplicationWindow(app)
  window.setContent(content)
  window.on('close-request', () => (loop.quit(), app.quit(), false))
  window.present()

  loop.run()
})

// Unlike ESM, under CommonJS the run call blocks and returns the exit status.
process.exit(app.run([]))
```

The only differences from ESM are module loading and the blocking main-loop
semantics described above.

## See also

- [API reference](./api.md) — `require`, `registerClass`, and the rest of the
  node-gtk API.
- [TypeScript](../README.md#typescript) — typed `gi:` imports and `gi.require`.
