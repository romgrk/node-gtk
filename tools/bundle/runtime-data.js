/*
 * runtime-data.js — GTK runtime pieces every platform bundles the same way:
 * the GObject-Introspection typelibs, compiled GSettings schemas and the
 * Adwaita/hicolor icon themes. Only the source prefix differs per platform
 * (/usr, the MinGW prefix, the Homebrew prefix).
 */

const fs = require('fs')
const path = require('path')

const { tryExec, exists, mkdirp, copyFile, copyTree } = require('./util.js')

function copyTypelibs(src, dst, log) {
  if (!exists(src))
    throw new Error(`typelib directory not found: ${src} — is gobject-introspection installed?`)
  mkdirp(dst)
  const typelibs = fs.readdirSync(src).filter(f => f.endsWith('.typelib'))
  for (const f of typelibs)
    copyFile(path.join(src, f), path.join(dst, f))
  log(`typelibs: ${typelibs.length} from ${src}`)
}

// Shared runtime data (identical logic for all prefixes): compiled GSettings
// schemas and the Adwaita/hicolor icon themes.
function copyRuntimeData(ctx, sharePrefix) {
  const { config, runtimeDir, log } = ctx
  const shareDst = path.join(runtimeDir, 'share')

  const schemas = path.join(sharePrefix, 'glib-2.0', 'schemas', 'gschemas.compiled')
  if (exists(schemas))
    copyFile(schemas, path.join(shareDst, 'glib-2.0', 'schemas', 'gschemas.compiled'))
  else
    log(`  (no compiled GSettings schemas at ${schemas})`)

  if (config.icons) {
    for (const theme of ['Adwaita', 'hicolor']) {
      const src = path.join(sharePrefix, 'icons', theme)
      if (exists(src))
        copyTree(src, path.join(shareDst, 'icons', theme))
    }
  }
}

function pkgConfigVar(pkg, variable) {
  const out = tryExec(`pkg-config --variable=${variable} ${pkg}`)
  const value = out !== undefined ? out.trim() : ''
  return value !== '' ? value : undefined
}

module.exports = { copyTypelibs, copyRuntimeData, pkgConfigVar }
