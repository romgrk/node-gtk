/*
 * platform-linux.js — Linux runtime assembly.
 *
 * Shared libraries are collected with ldd (which prints the full transitive
 * closure) seeded from the compiled addon, the GI namespace libraries
 * (seeds.js) and the gdk-pixbuf loaders. Host-provided libraries (glibc, GPU
 * drivers, X11/Wayland client stack, font stack — see seeds.js) are excluded,
 * following the AppImage community excludelist.
 *
 * The launcher is a POSIX sh script that wires LD_LIBRARY_PATH,
 * GI_TYPELIB_PATH and XDG_DATA_DIRS to the bundled runtime, materializes a
 * gdk-pixbuf loader cache with absolute paths (written to the user's cache
 * dir — the cache format has no relative-path support), then execs the
 * bundled node on the app entry.
 *
 * Note the binary compatibility baseline: the bundle runs on distributions
 * whose glibc is at least as new as the build machine's. Build on the oldest
 * distribution you want to support (CI: ubuntu-latest).
 */

const fs = require('fs')
const path = require('path')

const { exec, tryExec, exists, mkdirp, copyFile, copyTree, formatSize } = require('./util.js')
const { seedNames, isExcludedLinux } = require('./seeds.js')

const NODE_BINARY = 'node'

function assembleRuntime(ctx) {
  const { config, runtimeDir, log } = ctx
  const libDir = path.join(runtimeDir, 'lib')
  mkdirp(libDir)

  // --- typelibs ------------------------------------------------------------
  // Copy the full set: it is small and guarantees every transitive namespace
  // dependency (Gdk, Pango, cairo, GdkPixbuf, Graphene, ...) is present.
  const typelibSrc = pkgConfigVar('gobject-introspection-1.0', 'typelibdir')
    || '/usr/lib/girepository-1.0'
  const typelibDst = path.join(libDir, 'girepository-1.0')
  copyTypelibs(typelibSrc, typelibDst, log)

  // --- shared-library closure ----------------------------------------------
  const ldcache = ldconfigCache()
  const seeds = []
  for (const name of seedNames('linux', config.libraries, config.gtk)) {
    const p = ldcache.get(name)
    if (p !== undefined)
      seeds.push(p)
    else
      log(`  (skip missing seed ${name})`)
  }

  const loaders = pixbufLoaders()
  const closure = lddClosure([ctx.bindingPath, ...seeds, ...loaders.files])

  // The seeds themselves are part of the runtime.
  for (const p of seeds)
    closure.set(path.basename(p), p)

  let copied = 0, excluded = 0
  for (const [name, src] of [...closure].sort()) {
    if (isExcludedLinux(name)) {
      excluded += 1
      continue
    }
    copyFile(fs.realpathSync(src), path.join(libDir, name))
    copied += 1
  }
  log(`libraries: ${copied} bundled, ${excluded} excluded (host-provided)`)

  // --- gdk-pixbuf loaders ---------------------------------------------------
  if (loaders.files.length > 0) {
    const loadersDst = path.join(libDir, 'gdk-pixbuf-2.0', '2.10.0', 'loaders')
    for (const file of loaders.files)
      copyFile(file, path.join(loadersDst, path.basename(file)))
    // The cache references loaders by absolute build-machine path; templatize
    // it so the launcher can point it at the install location.
    if (loaders.cache !== undefined) {
      const template = fs.readFileSync(loaders.cache, 'utf8')
        .replace(/^"[^"]*[\\/]([^"\\/]+\.so)"/gm, '"@LOADERS_DIR@/$1"')
      fs.writeFileSync(path.join(loadersDst, '..', 'loaders.cache.in'), template)
    }
    log(`gdk-pixbuf: ${loaders.files.length} loaders`)
  }

  // --- GSettings schemas + icon themes --------------------------------------
  copyRuntimeData(ctx, '/usr/share')
}

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

// name -> path for every library in the loader cache, matching the current
// architecture when ldconfig tags one.
function ldconfigCache() {
  const out = tryExec('ldconfig -p') || exec('/sbin/ldconfig -p')
  const archTag = { x64: 'x86-64', arm64: 'AArch64' }[process.arch]
  const map = new Map()
  for (const line of out.split('\n')) {
    const m = /^\s*(\S+)\s+\(([^)]*)\)\s+=>\s+(\/\S+)$/.exec(line)
    if (m === null)
      continue
    const [, name, tags, libPath] = m
    if (archTag !== undefined && !tags.includes(archTag))
      continue
    if (!map.has(name))
      map.set(name, libPath)
  }
  return map
}

// Union of the transitive dependency closures of `files`: soname -> path.
// ldd resolves recursively, so one invocation per entry point suffices.
function lddClosure(files) {
  const closure = new Map()
  for (const file of files) {
    const out = tryExec(`ldd ${JSON.stringify(file)}`)
    if (out === undefined)
      continue
    for (const line of out.split('\n')) {
      const m = /^\s*(\S+)\s+=>\s+(\/\S+)\s+\(0x/.exec(line)
      if (m !== null && !closure.has(m[1]))
        closure.set(m[1], m[2])
    }
  }
  return closure
}

function pixbufLoaders() {
  const moduleDir = pkgConfigVar('gdk-pixbuf-2.0', 'gdk_pixbuf_moduledir')
    || '/usr/lib/gdk-pixbuf-2.0/2.10.0/loaders'
  if (!exists(moduleDir))
    return { files: [] }
  const files = fs.readdirSync(moduleDir)
    .filter(f => f.endsWith('.so'))
    .map(f => path.join(moduleDir, f))
  const cache = pkgConfigVar('gdk-pixbuf-2.0', 'gdk_pixbuf_cache_file')
    || path.join(moduleDir, '..', 'loaders.cache')
  return { files, cache: exists(cache) ? cache : undefined }
}

function pkgConfigVar(pkg, variable) {
  const out = tryExec(`pkg-config --variable=${variable} ${pkg}`)
  const value = out !== undefined ? out.trim() : ''
  return value !== '' ? value : undefined
}

function writeLauncher(ctx) {
  const { config, outBase } = ctx
  const nodeArgs = config.nodeArgs.length > 0 ? config.nodeArgs.join(' ') + ' ' : ''
  const launcherPath = path.join(outBase, config.name)
  const entry = config.entry.split(path.sep).join('/')

  fs.writeFileSync(launcherPath, `#!/bin/sh
# ${config.name} launcher — generated by \`node-gtk bundle\`.
# Wires the bundled GTK runtime (libraries, typelibs, schemas, icons,
# gdk-pixbuf loaders), then execs the bundled node on the app entry.
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
RT="$HERE/runtime"

export LD_LIBRARY_PATH="$RT/lib\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export GI_TYPELIB_PATH="$RT/lib/girepository-1.0\${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"
export XDG_DATA_DIRS="$RT/share:\${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"

# The loader cache format only supports absolute paths; materialize one for
# this install location in the user's cache dir.
LOADERS_DIR="$RT/lib/gdk-pixbuf-2.0/2.10.0/loaders"
if [ -f "$LOADERS_DIR/../loaders.cache.in" ]; then
  GDK_PIXBUF_MODULE_FILE="\${XDG_CACHE_HOME:-$HOME/.cache}/${config.id}/loaders.cache"
  mkdir -p "$(dirname "$GDK_PIXBUF_MODULE_FILE")"
  sed "s|@LOADERS_DIR@|$LOADERS_DIR|g" "$LOADERS_DIR/../loaders.cache.in" > "$GDK_PIXBUF_MODULE_FILE"
  export GDK_PIXBUF_MODULE_FILE
fi

# Run from app/ so bare-specifier nodeArgs (--import node-gtk/register) and
# the app's own relative paths resolve regardless of the invoking cwd.
cd "$HERE/app" || exit 1
exec "$RT/node" ${nodeArgs}"./${entry}" "$@"
`)
  fs.chmodSync(launcherPath, 0o755)
  return launcherPath
}

function archive(ctx) {
  const { outBase, log } = ctx
  const archivePath = `${outBase}.tar.gz`
  exec(`tar -czf ${JSON.stringify(archivePath)} -C ${JSON.stringify(path.dirname(outBase))} ${JSON.stringify(path.basename(outBase))}`)
  log(`archive: ${archivePath} (${formatSize(fs.statSync(archivePath).size)})`)
  return archivePath
}

module.exports = { NODE_BINARY, assembleRuntime, writeLauncher, archive }
