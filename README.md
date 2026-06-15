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
use any introspected library, such as Gtk+, usable. It is similar in essence to [GJS](https://wiki.gnome.org/action/show/Projects/Gjs) or [PyGObject](https://pygobject.readthedocs.io). Please note this project is currently in a _beta_ state and is being developed. Any contributors willing to help
will be welcomed.

Supported Node.js versions: **20**, **22**, **24** (other versions may work but are untested)<br>
Pre-built binaries available for: **Linux**, **macOS**

### Table of contents

- [Usage](#usage)
- [Documentation](#documentation)
- [TypeScript](#typescript)
- [Installing and building](#installing-and-building)
- [Contributing](#contributing)

## Usage

Below is a [minimal example](./examples/hello-world.js) of how to use node-gtk:

```javascript
const gi = require('node-gtk');
const GLib = gi.require('GLib', '2.0');
const Gtk = gi.require('Gtk', '4.0');
const Adw = gi.require('Adw', '1');

const loop = GLib.MainLoop.new(null, false);
const app = new Adw.Application('com.github.romgrk.node-gtk.hello', 0);

app.on('activate', () => {
  const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
  content.append(new Adw.HeaderBar());
  content.append(new Gtk.Label({ label: 'Hello Adwaita!', vexpand: true }));

  const window = new Adw.ApplicationWindow(app);
  window.setTitle('node-gtk');
  window.setDefaultSize(300, 120);
  window.setContent(content);
  window.on('close-request', () => (loop.quit(), app.quit(), false));
  window.present();

  gi.startLoop();
  loop.run();
});

process.exit(app.run([]));
```

<p align="center">
  <img src="./img/hello-world.png" style="width: 290px; height: auto;"/>
</p>

#### ES modules

The example above is CommonJS. node-gtk also works under ES modules, but with one
behavioral difference around the blocking main-loop calls (`GLib.MainLoop.run`,
`Gio`/`Gtk.Application.run`, `Gtk.main`).

Under ESM, a module's top-level body runs as a V8 *microtask*. If a blocking
loop call ran synchronously from there, it would nest inside V8's microtask
drain and starve every `Promise`/`async` continuation (so `await fetch(...)`,
`fs/promises`, etc. would never settle) for the entire lifetime of the loop —
see [#442](https://github.com/romgrk/node-gtk/issues/442). To avoid this,
node-gtk defers the blocking call to the next event-loop tick when it detects it
is being invoked from within a microtask. Two consequences for ESM code:

- The run call **returns immediately** instead of blocking until quit, so any
  code placed *after* it executes *before* the loop. Make the run call the last
  statement, and do cleanup/exit from your quit/`close-request` handler.
- Its **return value is not available** (e.g. the application's exit status), so
  don't wrap it like `process.exit(app.run([]))` — call `app.run([])` on its own
  and exit from the handler instead.

Under CommonJS (and inside signal callbacks) nothing changes: the run calls block
synchronously and return their value exactly as before.

> **Design note (may be reconsidered).** Two approaches were considered for #442:
>
> - **Transparent auto-defer (chosen).** node-gtk detects the microtask context
>   and defers the blocking call automatically, so existing ESM code keeps
>   working with no changes. The cost is the leaky behavior above: under ESM the
>   run call no longer blocks, which is surprising and silently breaks idioms
>   like `process.exit(app.run([]))`.
> - **Explicit async API (alternative).** Keep the blocking calls strictly
>   synchronous and add awaitable variants (e.g. `await loop.runAsync()`),
>   leaving ESM users to opt in. This has clean, predictable semantics and no
>   hidden return-immediately behavior, but it does *not* transparently fix
>   existing ESM code — users must change their code, and plain `loop.run()`
>   would still starve microtasks under ESM (or would need to throw/warn).
>
> The transparent approach was chosen to fix existing code out of the box, but
> given the leaky semantics this trade-off may be revisited — possibly moving to
> (or also offering) the explicit async API.

You can also easily create custom applications:

[A web browser (using WebKit2GTK)](./examples/browser.js)

<p align="center">
  <img src="./img/browser.png" style="max-width: 500px; height: auto;"/>
</p>

[A system monitor](./examples/system-monitor.js)

<p align="center">
  <img src="./img/system-monitor.png" style="width: 400px; height: auto;"/>
</p>

#### Other projects

The [react-gtk](https://github.com/codejamninja/react-gtk) project may also allow you to use GTK via React (unmaintained).

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

## Installing and building

See [Installing & building](./doc/installation.md) for prebuilt-binary notes, per-platform build instructions (Linux, macOS, Windows), and how to run the tests and examples.

## Contributing

If you'd like to help, we'd be more than happy to have support. To setup your development environment, you can
run `npm run configure`. You can then build the project with `npm run build`. To generate the `compile_commands.json`
for LSP to work nicely, you can use [bear](https://github.com/rizsotto/Bear) as `bear -- npm run build`.

- https://developer.gnome.org/gi/stable/index.html
- https://v8docs.nodesource.com/
- https://github.com/nodejs/nan#api

There is a [Discord channel](https://discord.gg/r2VqPUV) but it receives little monitoring, use github issues or
discussions preferably.
