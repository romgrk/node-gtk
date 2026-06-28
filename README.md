<p align="center">
    <a>
      <img
        alt="NODE-GTK"
        width="200"
        src="https://raw.githubusercontent.com/romgrk/node-gtk/master/img/node-gtk-logo.svg?sanitize=true"
      />
    </a>
</p>

<h1 align="center">node-gtk</h1>
<p align="center">
  <b>GTK bindings for NodeJS</b>
  <br/>
</p>

<p align="center">
  <a href="#usage">Usage</a> · <a href="#installing">Installing</a> · <a href="#documentation">Documentation</a> · <a href="#contributing">Contributing</a>
</p>

<br />

`node-gtk` lets you build native GTK apps on **linux**, **macOS** and 
**windows** with full **ESM** and **TypeScript** support. Prebuilt binaries 
are available for Node.js versions **20**, **22** and **24**.

<p align="center">
  <img src="./img/browser.png" style="max-width: 500px; height: auto;" alt="A web browser build with node-gtk" />
</p>

## Usage

The **create** tool generates a complete, ready-to-run GTK/Adwaita project, so you
can start building immediately after [installing GTK4](#installing):

```sh
npx node-gtk create <your-app>
```

<p align="center">
  <img src="./img/create-app-example.png" style="width: 500px; height: auto;"/>
</p>

See our examples such as [a web browser](./examples/browser.mjs) or 
[a system monitor](./examples/system-monitor.mjs).

## Installing

There are two steps:

1. Install `node-gtk` itself (*done by the create tool*)
2. Install the native libraries you use (see examples per platform below)

#### Linux

```sh
# archlinux
pacman -S gtk4 libadwaita

# fedora
dnf install gtk4 libadwaita

# ubuntu
# Already installed :)
```

#### macOS

```sh
brew install gtk4 libadwaita adwaita-icon-theme
```

#### Windows

```sh
# Already installed :)
```

> [!NOTE]
> Windows doesn't have the dependencies we need in a package manager, therefore
> `node-gtk` ships prebuilt versions of GTK 4 / Adwaita, so `npm install node-gtk`
> is all you need **if** your dependency is in our 
> [list of prebuilt libraries](./windows/runtime-libraries.txt).

### build from source

Building from source, or contributing? See [Building from source](./doc/building.md).

## Documentation

[Read our documentation here](./doc/index.md)

## ES modules

ES modules are the default: namespaces are imported with the
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

## TypeScript

node-gtk can generate TypeScript declarations for the libraries you use,
straight from the GObject-Introspection typelibs installed on your machine — so
the types always match your actual library versions. See the
**[TypeScript guide](./doc/typescript.md)**.

## Contributing

`node-gtk` is a [gobject-introspection](https://gi.readthedocs.io/en/latest) library 
for nodejs. It makes it possible to use any introspected C library, such as GTK, 
usable. It is similar in essence to [GJS](https://wiki.gnome.org/action/show/Projects/Gjs) 
or [PyGObject](https://pygobject.readthedocs.io).

If you'd like to help, we'd be more than happy to have support. To setup your development environment, you can
run `npm run configure`. You can then build the project with `npm run build`. To generate the `compile_commands.json`
for LSP to work nicely, you can use [bear](https://github.com/rizsotto/Bear) as `bear -- npm run build`.

- https://developer.gnome.org/gi/stable/index.html
- https://v8docs.nodesource.com/
- https://github.com/nodejs/nan#api
