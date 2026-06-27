/*
 * hooks.mjs — Node.js ESM module-customization hooks for the `gi:` scheme.
 *
 * Enables `import Gtk from 'gi:Gtk-4.0'`, where the default export is the
 * namespace object returned by node-gtk's `gi.require('Gtk', '4.0')`. Members are
 * read off that object: `const { Box, Label } = Gtk`.
 *
 * Install them with `node --import node-gtk/register app.mjs` (see register.mjs).
 *
 * The hooks run on a separate loader thread, so they do NO native work: `load`
 * only emits a tiny synthetic ES module whose body calls `gi.require` on the
 * main thread when the module is evaluated. Requires Node >= 20.6 (module.register).
 */

const PREFIX = 'gi:'

/* Absolute file:// URL to lib/index.js, embedded into the generated source. The
 * synthetic module's parent URL is the schemeless `gi:` URL, which has no
 * filesystem base, so a bare `import 'node-gtk'` could not be resolved from it —
 * the absolute URL sidesteps resolution entirely. */
const INDEX_URL = new URL('../index.js', import.meta.url).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(PREFIX))
    return { url: specifier, shortCircuit: true }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
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
