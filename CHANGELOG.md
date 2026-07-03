# Changelog

Changes to be released are kept in the unreleased section.

## Unreleased

## v4.1.0

### Performance

- **~4× faster startup: GIR types are now initialized lazily** (#480).
  `require('node-gtk')` went from 75ms to 18ms and `gi.require('Gtk', '4.0')`
  from 177ms to 38ms (hello-world total: 252ms → 60ms). Namespace entries are
  materialized on first access instead of eagerly for the whole dependency
  closure; types first reached from C (method returns, signal arguments) are
  materialized through a native hook before any wrapper is handed out, and
  every GType is still registered up front so by-name lookups
  (`GObject.typeFromName()`, GtkBuilder XML) keep working. The
  fully-materialized API surface is unchanged. Visible differences: untouched
  namespace entries print as `[Getter]` in `console.log`, and "class failed to
  load" warnings fire on first access rather than at require time.

### Fixes

- **Transfer-full return values from JS callbacks now transfer a reference to
  the caller** (#482). When C takes ownership of a callback's return value
  (e.g. a `GtkTreeListModelCreateModelFunc` returning a fresh `Gio.ListModel`),
  node-gtk did not add the reference the caller owns, so the object could be
  finalized while still in use — an intermittent SIGSEGV, observed in
  `GtkTreeListModel` teardown. GObject, boxed, fundamental and `GVariant`
  returns are now ref'd/copied on the callback return path, mirroring the
  existing transfer-full IN-argument handling.

### Build

- Updated `@mapbox/node-pre-gyp` to v2 and mocha to v11, clearing the open
  dependabot alerts (#481).
- Compiled binaries are no longer accidentally included in the npm tarball.

## v4.0.1

### Fixes

- **A running `GApplication` no longer busy-spins at 100% CPU under ES modules**
  (most visible on Node.js 26 / libuv 1.52). Under ESM the blocking `run()` is
  deferred to a macrotask so pending Promise/async continuations keep draining
  (#442); that deferral used `setImmediate`, whose callback runs inside Node's
  immediate-processing machinery. Because `run()` never returns (it blocks in
  the GLib main loop), Node never got the chance to stop its private immediate
  `uv_idle` handle, which pinned `uv_backend_timeout()` at `0` and made the
  nested uv-in-GLib loop spin, starving the app. The deferral now uses a
  `setTimeout(…, 0)` macrotask, which leaves no libuv state active while it
  blocks (#477).

## v4.0.0

### Breaking changes

- **Dropped support for Node.js 20.** Prebuilt binaries are now published for
  Node.js **22**, **24** and **26**.

### Features

- **Node.js 26 support** (V8 14 / ABI 147). The native binding was ported to the
  V8 APIs shipped in Node 26, preferring Nan wrappers over raw V8 version guards.

### Fixes

- Methods from a `GInterface` are now available directly on instances of
  private/non-introspectable concrete types. For example a `Gio.File` returned by
  `Gio.File.newForPath()` is a `GLocalFile` (a private type), and previously
  `file.getPath()`, `file.enumerateChildren()`, … lived only on
  `Gio.File.prototype`. The interface methods are now mixed into the instance's
  prototype at wrap time, so they can be called directly. This also removes the
  need for the manual `getFile()` prototype fixups in the Gtk 4 overrides (#441).
- **Fundamental (non-`GObject`) reference-counted types are now wrapped
  correctly.** Types such as `Gsk.RenderNode` were previously wrapped as though
  they were `GObject`s, which produced `G_IS_OBJECT` criticals on wrap, use and
  teardown. They are now handled by a dedicated fundamental-type subsystem that
  ref/unrefs them through their own type's vtable rather than toggle-referencing
  them (#468).
- **`GLib.Variant` passed into a signal handler is no longer NULL or corrupt.**
  `GVariant` is now wrapped as a ref-counted fundamental type, so a variant handed
  to a signal callback (e.g. `Gio.SimpleAction`'s `::change-state`) is readable
  inside the handler and keeps its own reference for the lifetime of the wrapper
  (#465).
- Nullable `char *` / array return values now return `null` instead of `""` / `[]`
  at end-of-stream (for example `Gio.DataInputStream.readLineFinish()` at EOF)
  (#467).

### Internal

- Dropped the `deasync` dependency — the last native `devDependency`. Async
  `describe()` blocks in the test suite now let each test process's own event loop
  drain the promise instead of blocking on `deasync`, whose pinned
  `node-addon-api` no longer builds on Node 26.
- The MSVC (Windows) build strips Node 26's ClangCL/ThinLTO linker flags, which
  are emitted for the MinGW toolchain but break the MSVC toolchain node-gtk uses
  on Windows.

## v3.0.0

### Breaking changes

- Removed `gi.startLoop()`. The GLib main-loop integration now starts
  automatically the first time you run a main loop, so the call is no longer
  needed — delete any `gi.startLoop()` from your code. See
  [importing](./doc/importing.md).
- **Virtual-function overrides now require a `virtual_` prefix.** A method
  overrides a vfunc only if it is named `virtual_` + the camelCase vfunc name
  (e.g. `virtual_sizeAllocate` overrides `size_allocate`). Previously any method
  whose `snake_case` name matched a vfunc was silently treated as an override, so
  a plain method named `dispose`, `getProperty`, `sizeAllocate`, … could hijack
  the matching vfunc. Rename your overrides to the `virtual_` form; plain methods
  are no longer overrides, and a `virtual_*` method that names no vfunc throws.
  See the [Inheritance guide](./doc/index.md#inheritance).

### Features

- **[`registerClass()`](./doc/api.md#register-class-klass) is now optional** —
  the first `new MySubclass()` registers the subclass on demand.
- **Direct ESM imports.** Import a namespace with the `gi:` scheme
  (`import Gtk from 'gi:Gtk-4.0'`) after running with
  `node --import node-gtk/register` (Node ≥ 20.6); node-gtk's own API is importable
  by name (`import { registerClass } from 'node-gtk'`). CommonJS (`gi.require`) is
  still supported. See the [importing guide](./doc/importing.md).
- **Automatic main-loop integration.** Running a main loop (`GLib.MainLoop.run`,
  `Gio`/`Gtk.Application.run`, `Gtk.main`) now starts the Node↔GLib loop
  integration automatically; this replaces the former `gi.startLoop()` call.
- **Typed `gi:` imports.** `node-gtk generate-types` now declares each
  `gi:<Namespace>-<version>` module, so `import Gtk from 'gi:Gtk-4.0'` is fully
  typed; importing a namespace you haven't generated types for is a TypeScript
  error that names the fix.
- **Typed virtual-function overrides.** `node-gtk generate-types` now emits each
  GObject vfunc as a `virtual_<name>` member, so subclass overrides are
  type-checked and `super.virtual_<name>(...)` resolves. (Interface vfuncs are not
  emitted — they collide across multiple-interface diamonds, e.g. GTK 3's Atk
  accessibility stack.)
- Support `super.virtual_<name>()` chain-up from a registered subclass. A vfunc
  override replaces the parent's implementation in the class vtable, so a JS
  subclass could not previously call the implementation it overrode. `registerClass`
  installs a bridge on the parent GI class's prototype that invokes the parent's
  native vfunc implementation, making the idiomatic `super.virtual_snapshot(...)`
  work. Because the override carries the `virtual_` prefix, its name is distinct
  from any public invoker method of the same vfunc, so `super` reaches the parent
  implementation without recursing.
- **Styles & hot-reload.** New `node-gtk/styles` subpath export — a small,
  dependency-free `StyleManager` wrapping `Gtk.CssProvider`/`Gtk.StyleContext`.
  It applies inline CSS (`styles.add`) and `.css` files (`styles.addFile`), and
  in development **hot-reloads** them as you edit, with no restart. Hot-reload
  is on when `NODE_ENV=development` (opt out with `NODE_GTK_STYLE_HOT_RELOAD=0`).
  `styles.add` also takes a `() => string` **render function** for dynamic CSS
  built from live state, re-applied on hot-reload and via the handle's
  `refresh()`; pass `{ watch: false }` to install a programmatic sheet without
  watching its module. Ships with TypeScript types.
  See [Styles & hot-reload](./doc/styles.md).
- **App creator.** `node-gtk create <dir>` creates a ready-to-run TypeScript +
  ESM Adwaita app, with `style.css` wired through `node-gtk/styles` so it
  hot-reloads live under `npm run dev`. See
  [Create a new app](./README.md#create-a-new-app).

### Fixes

- A signal handler that closes over the object it is connected to no longer
  leaks it. Handlers are now kept in a JS array on the wrapper (reachable only
  through the wrapper) instead of a strong C++ reference, so the wrapper↔handler
  reference loop is garbage-collected; this also covers handlers on
  `Gtk.EventController`s and `Gtk.Gesture`s. See
  [Signal handlers and GC](./doc/signal-handler-gc.md) (#463, based on #375 by
  @peat-psuwit).

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
