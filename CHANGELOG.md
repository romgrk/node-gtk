# Changelog

Changes to be released are kept in the unreleased section.

## Unreleased

### Breaking changes

- Removed `gi.startLoop()`. The GLib main-loop integration now starts
  automatically the first time you run a main loop, so the call is no longer
  needed — delete any `gi.startLoop()` from your code.

### Features

- **Direct ESM imports.** Import a GObject-Introspection namespace with the `gi:`
  scheme — `import Gtk from 'gi:Gtk-4.0'`, whose default export is the namespace
  object — after installing the hooks with `node --import node-gtk/register`. The
  examples and README now use this style by default; CommonJS (`gi.require`) is
  still supported. Requires Node ≥ 20.6.
- **Named ESM imports from `node-gtk`.** node-gtk's own API can now be imported by
  name — `import gi, { registerClass } from 'node-gtk'` — via a new ESM entry point
  that re-exports the CommonJS API (the same module instance, so there is no
  duplicated state).
- **Automatic main-loop integration.** Running a main loop (`GLib.MainLoop.run`,
  `Gio`/`Gtk.Application.run`, `Gtk.main`) now starts the Node↔GLib loop
  integration automatically; this replaces the former `gi.startLoop()` call.
- **Deferred `registerClass()`.** `registerClass` may now be called before the
  runtime is ready: if a class's parent GType isn't registered yet, the call is
  accumulated and retried once it (or its namespace) loads, making registration
  order-independent. It now returns the class (so it can be used as a decorator),
  and `flushRegistrations()` is exposed to retry pending registrations manually.
- **Typed `gi:` imports.** `node-gtk generate-types` now declares each
  `gi:<Namespace>-<version>` module, so `import Gtk from 'gi:Gtk-4.0'` is fully
  typed. Importing a namespace you haven't generated types for is a TypeScript
  error that names the fix.
- Support `super.<vfunc>()` chain-up from a registered subclass. A vfunc override
  replaces the parent's implementation in the class vtable, so a JS subclass could
  not previously call the implementation it overrode. `registerClass` now installs
  a bridge on the parent GI class's prototype that invokes the parent's native
  vfunc implementation, making the idiomatic `super.snapshotLine(...)` work. Applies
  to "pure" vfuncs (those without a same-named public invoker method, e.g.
  `snapshot_line`, `query_data`, `constructed`); invoker-backed vfuncs such as
  `get_request_mode` are intentionally not bridged (their prototype method already
  dispatches virtually, so `super` would recurse).

## v2.2.0

### Features

- Prebuilt binaries for **Windows**. `npm install node-gtk` now works on Windows
  with no MSYS2 and no compiler: the prebuilt bundles the GTK 4 / Adwaita runtime
  (DLLs, GObject-Introspection typelibs, and data), and node-gtk wires it up at
  load time. The bundled libraries are listed in `windows/runtime-libraries.txt`;
  the terminal widget Vte is the one exception, as it has no Windows port (#450).

## v2.1.0

### Fixes

- Pass caller-allocated out-struct signal parameters (e.g.
  `GtkOverlay::get-child-position`'s `GdkRectangle`) as live wrappers so
  handlers can fill them in place instead of receiving `null` (#444, #445).
- Drain Promise/`async` microtasks while the GLib main loop runs under ES
  modules; they were previously starved until the loop exited (#442).
- Fixed several GObject wrapper lifetime crashes: revival of toggled-up
  wrappers, collected-while-owned objects, and over-unref of transfer-full IN
  GObjects (#439).
- Guard the GObject toggle-reference notify against a zapped V8 handle during
  GC (#438).
- Stop the main loop busy-spinning at 100% CPU when an unref'd libuv handle
  keeps the backend fd readable (#437).

## v2.0.0

### Breaking

- **64-bit integers are now marshalled as `BigInt`** instead of `Number`, so
  values above `Number.MAX_SAFE_INTEGER` keep full precision (#323, #149). This
  covers `gint64`/`guint64`, the platform-dependent
  `glong`/`gulong`/`gsize`/`gssize` (64-bit on LP64 platforms), and `GType`.
  Both `Number` and `BigInt` are accepted as input, so code passing values in
  is unaffected; code reading 64-bit properties, return values, struct/union
  fields, or signal arguments now receives a `BigInt`.

### Features

- Added TypeScript type generation via `node-gtk gen-types`, an in-package
  generator that emits types matching your installed library versions and
  node-gtk's runtime behaviour (#428).
- Added `gi.getGType()` to get the `GType` of a class or instance (#286).
- Constructors now accept camelCase property names in addition to
  kebab/snake-case (#320).
- Added JS array → `GPtrArray` marshalling for IN/inout arguments (#401).
- Added JS array ↔ `GStrv` conversion for properties (#175).

### Fixes

- Call callbacks via the executable trampoline address, fixing a segfault with
  libffi 3.4+ exec-trampolines seen on newer distros (#390).
- Don't abort on `GValue` types that can't be unboxed (#389).
- Access union fields at offset 0 to avoid an out-of-bounds read/write (#376).
- Allocate registered boxeds with `g_slice` to match `g_boxed_free` (#290, #213).
- Copy boxed arguments passed as transfer-full IN to avoid a double free (#409).
- Marshal `(out)`/`(inout)` signal parameters correctly (#405).
- Don't walk a callee-freed container when freeing transfer-container IN
  elements (#399).
- Unbox array-of-`GValue` returns instead of overflowing the stack (#398).
- Marshal a NULL `GHashTable` out-param to an empty object (#400).
- Copy struct contents when marshalling a JS array to a C array of structs by
  value (#404).
- Marshal integer-keyed `GHashTable` IN without dereferencing keys (#402).
- Report the original property name for an unknown construct property (#320).
- Disown boxed wrappers freed via their own `*_free`/`*_unref` methods to avoid
  a double free (#429).
- Fixed nine correctness/safety bugs found in a full-source review (#395).

## v0.5.0

- Added support for GError
- Added `getProperty` and `setProperty` to GObject
- Improve handling of non-introspected objects

## v0.4.0

- Added `cairo` bindings
- Improved memory management
- Added support for node 13.x
- Added override for `Gtk.Builder#getObject`

## v0.3.0

- Added export `System` for low-level inspection
- Added overrides to module `Pango`
- Added support for complex out-arguments in function calls
- Added support for node 12.x
