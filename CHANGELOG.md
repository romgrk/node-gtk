# Changelog

Changes to be released are kept in the unreleased section.

## Unreleased

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
