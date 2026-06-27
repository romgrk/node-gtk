# Styles & hot-reload

`node-gtk/styles` is a small helper for applying CSS to a GTK app — and, in
development, **hot-reloading** it so the window updates as you edit, with no
restart. It wraps the usual `Gtk.CssProvider` + `Gtk.StyleContext` dance behind a
single `styles` object.

```javascript
import { styles } from 'node-gtk/styles'
```

It targets GTK 4 (the version your app already loaded is used automatically).

## Quick start

```javascript
import Gtk from 'gi:Gtk-4.0'
import { styles } from 'node-gtk/styles'

app.on('activate', () => {
  // A .css file (re-read live on edit in development):
  styles.addFile(new URL('../style.css', import.meta.url))

  // Inline CSS:
  styles.add(`button.suggested-action { padding: 0 24px; }`)

  // ...build your window...

  styles.install()   // flush queued styles and start the watcher
  window.present()
})
```

## The three kinds of styles

| Method | Use it for | Hot-reload |
| --- | --- | --- |
| `styles.addFile(path)` | a `.css` stylesheet | re-reads the file into its provider |
| `styles.add(css)` | inline CSS in a source module | re-imports that module (see the caveat below) |
| `styles.set(css, { key })` | dynamic, *keyed* CSS you replace from code | n/a — you drive it |

`styles.add` / `styles.addFile` return a **handle** — `{ update(next), remove() }` —
so you can replace or drop a sheet later from code:

```javascript
const sheet = styles.add(`label { color: red; }`)
sheet.update(`label { color: green; }`)   // replace in place
sheet.remove()                            // remove from the display
```

`styles.set` is for CSS your app changes at runtime (e.g. theme-derived colors).
Reusing the same `key` replaces the previous sheet in place instead of stacking
a new provider:

```javascript
styles.set(`window { --accent: ${color}; }`, { key: 'theme' })  // call again to update
styles.remove('theme')                                          // or remove it
```

## When styles install

The default display does not exist at module-init time, so styles added before
the app activates are **queued**. Call `styles.install()` once from your
`activate` handler to flush the queue (and start the file watcher). Styles added
*after* the display exists install immediately — and the first such call
auto-flushes the queue, so an app that does all its styling inside `activate`
never strictly needs `install()`. (`styles.set` always requires the display.)

`priority` defaults to `Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION`; pass
`{ priority }` to override it.

## Hot-reload

Hot-reload runs **only when `NODE_ENV=development`** (and is silently off
otherwise — in production nothing is watched). Within development you can opt out
with `NODE_GTK_STYLE_HOT_RELOAD=0`.

Every file that contributes styles is watched (via Node's `fs.watch`, no extra
dependency):

- **A `.css` file** is re-read into its existing provider. GTK re-resolves the
  style cascade live — no flash, no restart. A malformed rule mid-edit is simply
  skipped by GTK (and logged), leaving the rest applied.

- **A source module** that called `styles.add()` is re-imported with a
  cache-busting query, so its `add()` calls reinstall the new CSS; the providers
  from the previous run are then removed. New sheets go up *before* the old come
  down, so there's no unstyled flash. If the module fails to load mid-edit (e.g.
  a syntax error), it rolls back to the previously working sheets.

### Caveat: keep reloadable inline CSS in a side-effect-free module

Reloading inline CSS **re-executes the whole module** it lives in. So put
hot-reloadable `styles.add()` calls in a module whose top level only registers
styles — never next to `app.run()` / window construction, or a reload would
re-run all of that too. A good pattern:

```javascript
// styles.ts — safe to re-run: it only registers styles
import { styles } from 'node-gtk/styles'
styles.add(`.headline { font-size: 20px; font-weight: bold; }`)
```

```javascript
// main.ts — imports the styles module; never put reloadable CSS here
import './styles.ts'
```

If you have inline CSS that must live in a non-reloadable module, register it
with `styles.addStatic(css)` — same as `add`, but never watched.

See [`examples/style-manager.mjs`](../examples/style-manager.mjs) for a runnable
demo of both reload paths.

## API

| Member | Description |
| --- | --- |
| `styles.add(css, { priority? })` | Inline CSS; hot-reloads via module re-import. Returns a handle. |
| `styles.addStatic(css, { priority? })` | Inline CSS that is never hot-reloaded. Returns a handle. |
| `styles.addFile(path, { priority?, watch? })` | A `.css` file (string, `file://` URL, or `URL`); hot-reloads by re-reading. Idempotent per path. Returns a handle. |
| `styles.set(css, { key?, priority? })` | Keyed dynamic sheet, replaced in place when `key` repeats. Requires the display. Returns a handle. |
| `styles.remove(key)` | Remove a keyed sheet. |
| `styles.install()` *(alias `flush()`)* | Install queued styles and start the watcher. |
| `styles.stopHotReload()` | Stop watching and clear pending reloads (teardown / tests). |

`StyleManager` (the class) and the convenience functions `addStyles`,
`addStyleFile`, and `installStyles` are also exported.
