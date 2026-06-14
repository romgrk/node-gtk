# node-gtk TypeScript types — PROTOTYPE (Model B: generate-on-demand)

Types are generated **on the user's machine** from the GObject-Introspection
typelibs they actually have installed, using node-gtk's own runtime introspection
(`require('node-gtk')._GIRepository`, the libgirepository C API exposed to JS).
Because the generator reads the same typelibs and applies the same name/shape
rules as `lib/bootstrap.js`, the output matches what node-gtk produces at runtime
— and it matches *their* library versions, not a bundled snapshot.

## User workflow

```sh
# 1. generate types for the namespaces you use (+ their dependency closure)
npx node-gtk gen-types Gtk-4.0 --outdir ./gtk-types

# 2. point tsconfig at the generated shim
```
```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "paths": { "node-gtk": ["./gtk-types/node-gtk.d.ts"] }
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

`gen-types` emits one `<Namespace>-<version>.d.ts` per namespace plus a
`node-gtk.d.ts` module shim. The shim overloads `require()` so each
`gi.require('Ns','ver')` resolves to the matching generated namespace; namespaces
you didn't generate fall back to `any`. Typically wired into a `postinstall`
script so it's invisible.

## Pieces (prototype)

- `bin/node-gtk.js` — CLI entry (`package.json` `"bin"`); dispatches `gen-types`.
- `tools/generate-types.js` — the generator. `run(argv)` / `generate(roots, outdir)`.
- `examples/ts-demo/` — `app.ts` (valid, typechecks clean) and `app-errors.ts`
  (4 deliberate mistakes, all caught). Run `gen-types` into `gtk-types/` first
  (see that dir's `.gitignore`).

## Verify the demo

```sh
node bin/node-gtk.js gen-types Gtk-4.0 --outdir examples/ts-demo/gtk-types
node_modules/.bin/tsc -p examples/ts-demo/tsconfig.json          # passes clean
sed 's/app.ts/app-errors.ts/' examples/ts-demo/tsconfig.json > examples/ts-demo/tsconfig.errors.json
node_modules/.bin/tsc -p examples/ts-demo/tsconfig.errors.json   # 4 errors caught
```

## Known limitations (prototype)

Real consumers use `skipLibCheck: true` (standard for generated GIR types) →
the generated types and demos compile with **0 errors**. Running `tsc` directly
over the `.d.ts` files surfaces ~52 internal conflicts — the canonical hard
cases of modeling GObject in TS (the same ones ts-for-gir handles):

- **TS2416/2417/2430** — subclass method/static/property override covariance.
- **TS2320** — class implementing multiple interfaces with a common ancestor
  whose member types conflict.

Other simplifications, each marked `// LIMITATION` in the generator:

- OUT/INOUT parameters are dropped (node-gtk surfaces them via return-value
  tupling — needs modeling).
- Callback parameter types not expanded (`(...args: any[]) => any`).
- `int64`/`uint64` typed `number` (may be `bigint` at runtime).
- Enum methods and interface constants not emitted.
- GIR doc comments not included (the typelib carries less than the `.gir`).
