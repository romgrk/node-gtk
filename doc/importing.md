# Importing libraries

To use the native libraries (GTK, GLib, Adwaita, …), run your app with the 
`node-gtk/register` hook:

```sh
node --import node-gtk/register app.mjs
```

and import any library as `import Name from 'gi:Name-Version'`:

```javascript
import GLib from 'gi:GLib-2.0'
import Gtk from 'gi:Gtk-4.0'
import Adw from 'gi:Adw-1'
```

To see your installed libraries and versions, run `node-gtk list`.

The **default export is the namespace object** — everything the library
provides is read off it:

```javascript
import Gtk from 'gi:Gtk-4.0'

const { Box, Label } = Gtk
const box = new Box({ orientation: Gtk.Orientation.VERTICAL })
```

Named imports (`import { Box } from 'gi:Gtk-4.0'`) are **not** supported —
destructure from the default export instead.

The `node-gtk/register` hook also sets up recommended Node.JS and GTK GPU options
for you, see [performance optimizations](#performance-optimizations) for details.

## A complete example

```javascript
// app.mjs — run with: node --import node-gtk/register app.mjs
import GLib from 'gi:GLib-2.0'
import Gtk from 'gi:Gtk-4.0'
import Adw from 'gi:Adw-1'

const loop = GLib.MainLoop.new(null, false)
const app = new Adw.Application('com.example.hello', 0)

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

app.run([])
```

More in [examples/](../examples).


## Other topics

> [!NOTE]
> This section covers topics that you don't need to know about if you're just starting 
> your app.

### node-gtk (gobject-introspection) API 

node-gtk's own API (`registerClass`, …) is imported from the `node-gtk` package
by name:

```javascript
import gi, { registerClass } from 'node-gtk'
```
### The event loop

The first time you run a main loop (`GLib.MainLoop.run`,
`Gio`/`Gtk.Application.run`, `Gtk.main`), node-gtk integrates it with Node's
event loop for you — timers, promises and I/O keep working, and there is nothing
to call to enable it.

One thing to know: under ESM those run calls **return immediately** instead of
blocking, and **don't return a value** — so make the run call the last statement
and do cleanup/exit from your handlers. The example above does exactly that: the
`close-request` handler quits the loop and the app, and the process exits. For
the why and the design trade-off, see
[#449](https://github.com/romgrk/node-gtk/issues/449).

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

### Performance optimizations

Besides installing the `gi:` hooks, `node-gtk/register` applies two
optimizations when it loads:

- **Persistent V8 compile cache** — compiled (and type-stripped) module bytecode
  is persisted across runs, for a measurably faster startup on app-sized module
  graphs. The cache lives in `$XDG_CACHE_HOME/node-compile-cache`
  (`~/.cache/node-compile-cache` by default); set `NODE_COMPILE_CACHE` to change
  the location or `NODE_DISABLE_COMPILE_CACHE=1` to opt out.

- **GL renderer on Linux** — GTK ≥ 4.22 defaults to the Vulkan renderer. On
  dual-GPU laptops where the only Vulkan ICD is NVIDIA's (a common Optimus
  setup), that renders every window on the discrete GPU: waking it adds ~1s to
  the first frame on every launch, and it stays awake — drawing battery — for
  the app's lifetime, even though the display runs on the integrated GPU. The
  register hook defaults `GSK_RENDERER=gl` (the GL renderer, which follows the
  compositor's device) instead. Setting `GSK_RENDERER` yourself takes
  precedence — any value, including `''` to get GTK's own choice back.

### CommonJS

node-gtk works under CommonJS too. Load namespaces with
`gi.require(name, version)` instead of `gi:` imports — the two are equivalent,
and the rest of the API is identical:

```javascript
const gi = require('node-gtk')
const GLib = gi.require('GLib', '2.0')
const Gtk = gi.require('Gtk', '4.0')
```

You run it with plain `node app.js` — no `--import` flag. The differences from
ESM:

- Main-loop run calls **block** and return their result, so
  `process.exit(app.run([]))` works as it does in C.
- The [performance optimizations](#performance-optimizations) are not applied —
  they live in the register hook. To get them, run with the same
  `--import node-gtk/register` flag (it works regardless of the entry point's
  module system).

## See also

- [API reference](./api.md) — `require`, `registerClass`, and the rest of the
  node-gtk API.
- [TypeScript](../README.md#typescript) — typed `gi:` imports and `gi.require`.
