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
  (5 deliberate mistakes, all caught). Generate types into `.node-gtk-types/` first
  (see that dir's `.gitignore`).

## Verify the demo

```sh
node bin/node-gtk.js generate-types Gtk-4.0 --outdir examples/ts-demo/.node-gtk-types
node_modules/.bin/tsc -p examples/ts-demo/tsconfig.json          # passes clean
sed 's/app.ts/app-errors.ts/' examples/ts-demo/tsconfig.json > examples/ts-demo/tsconfig.errors.json
node_modules/.bin/tsc -p examples/ts-demo/tsconfig.errors.json   # 5 errors caught
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
- Virtual functions emitted as the `virtual_*` override surface that
  `registerClass` wires into the vtable (`virtual_sizeAllocate` overrides
  `size_allocate`), including invoker-less lifecycle vfuncs (`virtual_dispose`,
  `virtual_constructed`, …) so subclass overrides are type-checked and
  `super.virtual_<name>()` chain-up resolves (issue #457).
- GObject override conflicts reconciled as overloads, so subclass methods stay
  assignable to inherited ones; multiple-interface signal/method conflicts
  resolved with a unified, assignable-to-all declaration.
- Interfaces emit both a type and a value, so constructor functions and
  constants work (`Gio.File.newForPath(...)`).
- Relative imports use `.js` extensions, so the output works under
  `moduleResolution` node16/nodenext (and bundler). `skipLibCheck` is no longer
  required for the GTK stack, though it remains a fine default.
- **JSDoc comments** from the `.gir` XML — class/method/property/signal/enum
  docs, with `@param`/`@returns`/`@deprecated` — so editors show GNOME's API docs
  on hover. The typelib doesn't carry docs, so this reads the matching
  `<Namespace>-<version>.gir` from `$XDG_DATA_DIRS/gir-1.0` (shipped by the
  library's `-dev`/`-devel` package). Best-effort: if the `.gir` is absent, types
  still generate without comments. Pass `--no-docs` for leaner output (~5× smaller).

## Remaining limitations

- **Overriding an inherited method that collides by name** in a user subclass
  (e.g. a gutter renderer's `activate(iter, …)` vs `GtkWidget.activate()`)
  requires the override to satisfy both signatures — an inherent consequence of
  the GObject API reusing a name, not specific to these types.
- **`virtual_*` overrides with non-primitive OUT params** are typed with those
  params in the return tuple (the public-method convention). At runtime a vfunc
  implementation receives non-primitive OUT params as objects to mutate rather
  than returning them; the common all-primitive case (e.g. `virtual_measure`)
  matches exactly.
- **Interface vfuncs are not emitted** (only object/class vfuncs). Emitting
  `virtual_*` members on interfaces collides across multiple-interface diamonds
  (e.g. GTK3's Atk accessibility stack → TS2320). Overriding an interface vfunc
  still works at runtime; it just isn't type-checked.

---

# `node-gtk create` — create a new app

`node-gtk create <directory>` creates a complete, ready-to-run GTK/Adwaita
application that uses node-gtk, so a new project is one command away.

```sh
npx node-gtk create my-app
cd my-app
npm run dev
```

It generates a TypeScript + ESM project: an idiomatic Adwaita application plus its
tooling — typed `gi:` imports (with `tsconfig` wired to the generated types) and
npm scripts to run (`dev`/`start`), build (`build`), and regenerate types
(`generate-types`, also run on `postinstall`).

### Options

```
node-gtk create <directory> [options]

  --name <name>      Human-facing app name (default: derived from <directory>)
  --app-id <id>      Reverse-DNS application id (default: com.example.<Name>)
  --no-install       Don't run `npm install` after creating the project
  --force            Create into <directory> even if it exists and is non-empty
  -h, --help         Show this help
```

The directory basename drives the defaults: `my-cool-app` →
name *"My Cool App"*, package `my-cool-app`, id `com.example.MyCoolApp`.

The command lives in `tools/create-app.js`; the generated files come from the
template tree in `tools/templates/app/`.
