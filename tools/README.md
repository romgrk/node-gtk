# node-gtk TypeScript types — PROTOTYPE (Model B: generate-on-demand)

Types are generated **on the user's machine** from the GObject-Introspection
typelibs they actually have installed, using node-gtk's own runtime introspection
(`require('node-gtk')._GIRepository`, the libgirepository C API exposed to JS).
Because the generator reads the same typelibs and applies the same name/shape
rules as `lib/bootstrap.js`, the output matches what node-gtk produces at runtime
— and it matches *their* library versions, not a bundled snapshot.

## User workflow

```sh
# 1. generate types for the namespaces you use (+ their dependency closure).
#    Output defaults to ./node_modules/.node-gtk-types (hidden, gitignored).
npx node-gtk generate-types Gtk-4.0

# 2. point tsconfig at the generated shim
```
```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "paths": { "node-gtk": ["./node_modules/.node-gtk-types/node-gtk.d.ts"] }
  }
}
```
```ts
// 3. write code — gi.require() is typed by string-literal overloads
import * as gi from 'node-gtk'
const Gtk = gi.require('Gtk', '4.0')      // inferred as the Gtk-4.0 namespace
const win = new Gtk.ApplicationWindow({ title: 'Hi', defaultWidth: 400 })
win.on('close-request', () => false)
```

`generate-types` emits one `<Namespace>-<version>.d.ts` per namespace plus a
`node-gtk.d.ts` module shim. The shim overloads `require()` so each
`gi.require('Ns','ver')` resolves to the matching generated namespace; namespaces
you didn't generate fall back to `any`. Because the default output lives under
`node_modules`, it's treated as a generated cache — wire it into a `postinstall`
script so it regenerates after install.

## Pieces (prototype)

- `bin/node-gtk.js` — CLI entry (`package.json` `"bin"`); dispatches `generate-types`.
- `tools/generate-types.js` — the generator. `run(argv)` / `generate(roots, outdir)`.
- `examples/ts-demo/` — `app.ts` (valid, typechecks clean) and `app-errors.ts`
  (4 deliberate mistakes, all caught). Generate types into `.node-gtk-types/` first
  (see that dir's `.gitignore`).

## Verify the demo

```sh
node bin/node-gtk.js generate-types Gtk-4.0 --outdir examples/ts-demo/.node-gtk-types
node_modules/.bin/tsc -p examples/ts-demo/tsconfig.json          # passes clean
sed 's/app.ts/app-errors.ts/' examples/ts-demo/tsconfig.json > examples/ts-demo/tsconfig.errors.json
node_modules/.bin/tsc -p examples/ts-demo/tsconfig.errors.json   # 4 errors caught
```

## Fidelity

The generated `.d.ts` for the full Gtk-3.0, Gtk-4.0, and Adw/GtkSource stacks
type-check with **0 errors even without `skipLibCheck`**. Modelled faithfully:

- OUT/INOUT params surfaced via the return value as node-gtk does
  (`getStartIter(): TextIter`, `getIterAtLine(n): [boolean, TextIter]`).
- Callback argument types expanded (e.g. `Gio.AsyncReadyCallback`).
- 64-bit ints return `bigint` (full precision, #323/#149); params accept
  `number | bigint`.
- Enum methods and interface constants emitted (declaration-merged).
- GObject override conflicts reconciled as overloads, so subclass methods stay
  assignable to inherited ones; multiple-interface signal/method conflicts
  resolved with a unified, assignable-to-all declaration.
- Interfaces emit both a type and a value, so constructor functions and
  constants work (`Gio.File.newForPath(...)`).
- Relative imports use `.js` extensions, so the output works under
  `moduleResolution` node16/nodenext (and bundler). `skipLibCheck` is no longer
  required for the GTK stack, though it remains a fine default.

## Remaining limitations

- **GIR doc comments** are not emitted — the compiled typelib does not carry
  them; this needs the `.gir` XML as a second input source.
- **Overriding an inherited method that collides by name** in a user subclass
  (e.g. a gutter renderer's `activate(iter, …)` vs `GtkWidget.activate()`)
  requires the override to satisfy both signatures — an inherent consequence of
  the GObject API reusing a name, not specific to these types.
