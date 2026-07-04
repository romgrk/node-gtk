/*
 * register.mjs — install the `gi:` import hooks.
 *
 * Usage:  node --import node-gtk/register app.mjs
 *
 * Then, in app.mjs:
 *     import Gtk from 'gi:Gtk-4.0'   // `gi:Name-Version`, or `gi:Name` for the latest
 *     const { Box, Label } = Gtk
 *
 * `import Gtk from 'gi:Gtk-4.0'` is equivalent to `gi.require('Gtk', '4.0')`: the
 * default export is the namespace object, so read members off it.
 *
 * The hooks are synchronous and run in-thread (module.registerHooks), so they must
 * not return promises. `load` does no native work itself: it emits a tiny synthetic
 * ES module whose body calls `gi.require` when that module is evaluated. Requires
 * Node >= 22.15 (module.registerHooks).
 *
 * Note: hooks only affect imports evaluated *after* registration. To use a static
 * `import ... from 'gi:...'` in your entry module, register via the `--import`
 * flag above (not a programmatic `import 'node-gtk/register'` in that same file).
 */

import { registerHooks } from 'node:module'

const PREFIX = 'gi:'

/* Absolute file:// URL to lib/index.js, embedded into the generated source. The
 * synthetic module's parent URL is the schemeless `gi:` URL, which has no
 * filesystem base, so a bare `import 'node-gtk'` could not be resolved from it —
 * the absolute URL sidesteps resolution entirely. */
const INDEX_URL = new URL('../index.js', import.meta.url).href

function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(PREFIX))
    return { url: specifier, shortCircuit: true }
  return nextResolve(specifier, context)
}

function load(url, context, nextLoad) {
  if (!url.startsWith(PREFIX))
    return nextLoad(url, context)

  // `gi:Gtk-4.0` -> ('Gtk', '4.0'); `gi:Adw-1` -> ('Adw', '1'); `gi:cairo` -> ('cairo', null).
  // Split on the first '-' only: GI namespace names never contain '-', versions may.
  const spec = url.slice(PREFIX.length)
  const dash = spec.indexOf('-')
  const name = dash === -1 ? spec : spec.slice(0, dash)
  const version = dash === -1 ? null : spec.slice(dash + 1)

  const call = version === null
    ? `gi.require(${JSON.stringify(name)})`
    : `gi.require(${JSON.stringify(name)}, ${JSON.stringify(version)})`

  const source =
    `import gi from ${JSON.stringify(INDEX_URL)};\n` +
    `export default ${call};\n`

  return { format: 'module', shortCircuit: true, source }
}

registerHooks({ resolve, load })
