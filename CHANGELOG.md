# Changelog

Changes to be released are kept in the unreleased section.

## Unreleased

- **BREAKING**: 64-bit integers are now marshalled as `BigInt` instead of
  `Number`, so values above `Number.MAX_SAFE_INTEGER` keep full precision
  (#323, #149). This covers `gint64`/`guint64`, the platform-dependent
  `glong`/`gulong`/`gsize`/`gssize` (64-bit on LP64 platforms), and `GType`.
  Both `Number` and `BigInt` are accepted as input, so code passing values in
  is unaffected; code reading 64-bit properties, return values, struct/union
  fields, or signal arguments now receives a `BigInt`.

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
