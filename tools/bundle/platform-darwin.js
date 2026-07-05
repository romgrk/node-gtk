/*
 * platform-darwin.js — macOS runtime assembly, as a <Name>.app bundle.
 *
 * The GTK stack comes from Homebrew. Making it run on machines without
 * Homebrew is a two-layer relocation:
 *
 *  1. install_name_tool rewrites. The dylib closure is walked transitively
 *     with `otool -L` (resolving @loader_path/@rpath references) and copied
 *     flat into runtime/lib; then every copied Mach-O gets its Homebrew load
 *     commands rewritten to @loader_path-relative names, and is ad-hoc
 *     re-signed (any header edit invalidates the signature, and unsigned
 *     code does not run on arm64). No LC_RPATH entries are added: -add_rpath
 *     needs free header padding and can fail, while -change to a shorter
 *     string always fits — Homebrew paths are long, @loader_path/<name> is
 *     short.
 *
 *  2. DYLD_FALLBACK_LIBRARY_PATH in the launcher. Typelibs bake the build
 *     machine's *absolute* shared-library paths, so GI g_module_open()s
 *     /opt/homebrew/... on the target; when that path does not exist, dyld
 *     retries the leaf name against the fallback path — which points at
 *     runtime/lib. The same net catches any load command a -change could not
 *     rewrite. SIP note: DYLD_* variables must be set *inside* the launcher
 *     script — they survive into our (unprotected) node binary, whereas
 *     variables inherited into a SIP-protected shell are silently dropped.
 *
 * The output is unsigned (ad-hoc): fine to run locally or distribute to
 * machines that clear quarantine, but real distribution needs Developer ID
 * signing + notarization on top (see doc/bundling.md). Bundles are
 * per-architecture — build arm64 and x86_64 separately, no universal.
 */

const fs = require('fs')
const path = require('path')

const { exec, tryExec, exists, mkdirp, copyFile, formatSize } = require('./util.js')
const { seedNames } = require('./seeds.js')
const { copyTypelibs, copyRuntimeData } = require('./runtime-data.js')

const NODE_BINARY = 'node'

// Apple strip has no --strip-unneeded; -x drops local symbols (~half the
// binary for a release node). Stripping invalidates the signature — re-sign
// ad hoc or the binary won't start on arm64.
function stripNode(nodeDest) {
  tryExec(`strip -x ${JSON.stringify(nodeDest)}`)
  tryExec(`codesign --force --sign - ${JSON.stringify(nodeDest)}`)
}

function brewPrefix() {
  const out = tryExec('brew --prefix')
  const guess = out !== undefined ? out.trim()
    : (process.arch === 'arm64' ? '/opt/homebrew' : '/usr/local')
  if (!exists(path.join(guess, 'lib', 'girepository-1.0')))
    throw new Error(`no GObject-Introspection typelibs under ${guess} — install the GTK stack with Homebrew (brew install gtk4 gobject-introspection)`)
  return fs.realpathSync(guess)
}

function assembleRuntime(ctx) {
  const { config, runtimeDir, log } = ctx
  const brew = brewPrefix()
  const libDir = path.join(runtimeDir, 'lib')
  mkdirp(libDir)

  // --- typelibs ------------------------------------------------------------
  copyTypelibs(path.join(brew, 'lib', 'girepository-1.0'),
    path.join(libDir, 'girepository-1.0'), log)

  // --- dylib closure ---------------------------------------------------------
  const seeds = []
  for (const name of seedNames('darwin', config.libraries, config.gtk)) {
    const p = path.join(brew, 'lib', name)
    if (exists(p))
      seeds.push(fs.realpathSync(p))
    else
      log(`  (skip missing seed ${name})`)
  }

  const loaders = pixbufLoaders(brew)
  const closure = otoolClosure([ctx.bindingPath, ...seeds, ...loaders.files], brew)

  // The seeds themselves are part of the runtime.
  for (const p of seeds)
    closure.set(path.basename(p), p)

  for (const [name, src] of [...closure].sort())
    copyFile(src, path.join(libDir, name))
  log(`libraries: ${closure.size} dylibs bundled (system libraries stay on the host)`)

  // --- gdk-pixbuf loaders ---------------------------------------------------
  const loadersDst = path.join(libDir, 'gdk-pixbuf-2.0', '2.10.0', 'loaders')
  if (loaders.files.length > 0) {
    for (const file of loaders.files)
      copyFile(file, path.join(loadersDst, path.basename(file)))
    // Same trick as Linux: the cache format only supports absolute paths, so
    // ship a template the launcher materializes for the install location.
    if (loaders.cache !== undefined) {
      const template = fs.readFileSync(loaders.cache, 'utf8')
        .replace(/^"[^"]*[\\/]([^"\\/]+\.(?:so|dylib))"/gm, '"@LOADERS_DIR@/$1"')
      fs.writeFileSync(path.join(loadersDst, '..', 'loaders.cache.in'), template)
    }
    log(`gdk-pixbuf: ${loaders.files.length} loaders`)
  }

  // --- relocation (layer 1) --------------------------------------------------
  relocate(ctx, libDir, loadersDst, log)

  // --- GSettings schemas + icon themes --------------------------------------
  copyRuntimeData(ctx, path.join(brew, 'share'))
  ensureCompiledSchemas(ctx, brew)
}

// Union of the transitive dependency closures of `files`: basename ->
// realpath, Homebrew libraries only (/usr/lib and /System always exist on the
// target and stay on the host). otool -L lists one level, so walk a queue.
function otoolClosure(files, brew) {
  const closure = new Map()
  const queue = files.map(f => fs.realpathSync(f))
  const visited = new Set(queue)
  while (queue.length > 0) {
    const file = queue.shift()
    for (const dep of otoolDeps(file, brew)) {
      let real
      try { real = fs.realpathSync(dep) } catch (e) { continue }
      if (real === file || !real.startsWith(brew + '/'))
        continue
      if (!closure.has(path.basename(real)))
        closure.set(path.basename(real), real)
      if (!visited.has(real)) {
        visited.add(real)
        queue.push(real)
      }
    }
  }
  return closure
}

function otoolDeps(file, brew) {
  const out = tryExec(`otool -L ${JSON.stringify(file)}`)
  if (out === undefined)
    return []
  const deps = []
  // First line is the file itself; a dylib then lists its own install name
  // before its dependencies (filtered by the real === file check upstream).
  for (const line of out.split('\n').slice(1)) {
    const m = /^\s+(\S+)\s+\(compatibility/.exec(line)
    if (m === null)
      continue
    const dep = resolveInstallName(m[1], path.dirname(file), brew)
    if (dep !== undefined)
      deps.push(dep)
  }
  return deps
}

// Turn an install name into a checkable path. @loader_path is relative to
// the *referencing* library; @rpath almost always means <brew>/lib for
// Homebrew-built libraries (their LC_RPATH points there).
function resolveInstallName(name, loaderDir, brew) {
  if (name.startsWith('@loader_path/'))
    return path.resolve(loaderDir, name.slice('@loader_path/'.length))
  if (name.startsWith('@rpath/'))
    return path.join(brew, 'lib', path.basename(name))
  if (name.startsWith('@executable_path/'))
    return undefined
  if (name.startsWith('/usr/lib') || name.startsWith('/System'))
    return undefined
  return name
}

// Layer 1: rewrite every copied Mach-O (dylibs, pixbuf loaders, the .node) so
// its bundled dependencies load @loader_path-relative. A failed rewrite (e.g.
// a grown @rpath string exceeding the header padding) is only a warning: the
// launcher's DYLD_FALLBACK_LIBRARY_PATH resolves the leaf name at run time.
function relocate(ctx, libDir, loadersDst, log) {
  const bundled = new Set(fs.readdirSync(libDir))

  const targets = fs.readdirSync(libDir)
    .filter(f => f.endsWith('.dylib'))
    .map(f => ({ file: path.join(libDir, f), toLib: '@loader_path' }))
  if (exists(loadersDst)) {
    for (const f of fs.readdirSync(loadersDst))
      targets.push({ file: path.join(loadersDst, f), toLib: '@loader_path/../../..' })
  }
  const bindingRel = path.relative(path.dirname(ctx.bindingPath), libDir)
  targets.push({ file: ctx.bindingPath, toLib: `@loader_path/${bindingRel}` })

  let rewritten = 0, failed = 0
  for (const { file, toLib } of targets) {
    const out = tryExec(`otool -L ${JSON.stringify(file)}`)
    if (out === undefined)
      continue
    const changes = []
    for (const line of out.split('\n').slice(1)) {
      const m = /^\s+(\S+)\s+\(compatibility/.exec(line)
      if (m === null)
        continue
      const name = m[1]
      const base = path.basename(name)
      if (name.startsWith('/usr/lib') || name.startsWith('/System'))
        continue
      if (base === path.basename(file) || !bundled.has(base))
        continue
      const relocated = `${toLib}/${base}`
      if (name !== relocated)
        changes.push(`-change ${JSON.stringify(name)} ${JSON.stringify(relocated)}`)
    }
    if (changes.length === 0)
      continue
    if (tryExec(`install_name_tool ${changes.join(' ')} ${JSON.stringify(file)}`) !== undefined)
      rewritten += 1
    else
      failed += 1
    tryExec(`codesign --force --sign - ${JSON.stringify(file)}`)
  }
  log(`relocation: ${rewritten} Mach-O files rewritten to @loader_path`
    + (failed > 0 ? ` (${failed} failed — the launcher's DYLD fallback covers them)` : ''))
}

// Homebrew's glib compiles schemas post-install, but not every machine has a
// current gschemas.compiled; build one into the bundle when it is missing.
function ensureCompiledSchemas(ctx, brew) {
  const dst = path.join(ctx.runtimeDir, 'share', 'glib-2.0', 'schemas')
  if (exists(path.join(dst, 'gschemas.compiled')))
    return
  const src = path.join(brew, 'share', 'glib-2.0', 'schemas')
  if (!exists(src))
    return
  mkdirp(dst)
  if (tryExec(`glib-compile-schemas ${JSON.stringify(src)} --targetdir ${JSON.stringify(dst)}`) === undefined)
    ctx.log('  (could not compile GSettings schemas — GTK apps may warn at startup)')
}

function pixbufLoaders(brew) {
  const moduleDir = path.join(brew, 'lib', 'gdk-pixbuf-2.0', '2.10.0', 'loaders')
  if (!exists(moduleDir))
    return { files: [] }
  const files = fs.readdirSync(moduleDir)
    .filter(f => f.endsWith('.so') || f.endsWith('.dylib'))
    .map(f => fs.realpathSync(path.join(moduleDir, f)))
  const cache = path.join(moduleDir, '..', 'loaders.cache')
  return { files, cache: exists(cache) ? cache : undefined }
}

function writeLauncher(ctx) {
  const { config, contentsDir } = ctx
  writeInfoPlist(ctx)

  const macosDir = path.join(contentsDir, 'MacOS')
  mkdirp(macosDir)
  const args = [...(config.register ? ['--import', 'node-gtk/register'] : []), ...config.nodeArgs]
  const nodeArgs = args.length > 0 ? args.join(' ') + ' ' : ''
  const launcherPath = path.join(macosDir, config.name)
  const entry = config.entry.split(path.sep).join('/')

  fs.writeFileSync(launcherPath, `#!/bin/sh
# ${config.name} launcher — generated by \`node-gtk bundle\`.
# Wires the bundled GTK runtime, then execs the bundled node on the app entry.
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
RES=$(CDPATH= cd -- "$HERE/../Resources" && pwd)
RT="$RES/runtime"

# DYLD_* must be exported HERE: SIP strips them from protected parent
# processes, but they survive from this script into the (unprotected) bundled
# node. The fallback path is what resolves the absolute Homebrew paths baked
# into typelibs — and any unrewritten load command — down to runtime/lib.
export DYLD_FALLBACK_LIBRARY_PATH="$RT/lib:/usr/local/lib:/usr/lib"
export GI_TYPELIB_PATH="$RT/lib/girepository-1.0\${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"
export XDG_DATA_DIRS="$RT/share:\${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
export GSETTINGS_SCHEMA_DIR="$RT/share/glib-2.0/schemas"

# The loader cache format only supports absolute paths; materialize one for
# this install location in the user's cache dir.
LOADERS_DIR="$RT/lib/gdk-pixbuf-2.0/2.10.0/loaders"
if [ -f "$LOADERS_DIR/../loaders.cache.in" ]; then
  GDK_PIXBUF_MODULE_FILE="\${XDG_CACHE_HOME:-$HOME/Library/Caches}/${config.id}/loaders.cache"
  mkdir -p "$(dirname "$GDK_PIXBUF_MODULE_FILE")"
  sed "s|@LOADERS_DIR@|$LOADERS_DIR|g" "$LOADERS_DIR/../loaders.cache.in" > "$GDK_PIXBUF_MODULE_FILE"
  export GDK_PIXBUF_MODULE_FILE
fi

# Run from app/ so bare-specifier node args (--import node-gtk/register) and
# the app's own relative paths resolve regardless of the invoking cwd.
cd "$RES/app" || exit 1
exec "$RT/node" ${nodeArgs}"./${entry}" "$@"
`)
  fs.chmodSync(launcherPath, 0o755)
  return launcherPath
}

function writeInfoPlist(ctx) {
  const { config, contentsDir } = ctx
  mkdirp(contentsDir)
  fs.writeFileSync(path.join(contentsDir, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleName</key><string>${config.name}</string>
  <key>CFBundleDisplayName</key><string>${config.name}</string>
  <key>CFBundleIdentifier</key><string>${config.id}</string>
  <key>CFBundleExecutable</key><string>${config.name}</string>
  <key>CFBundleShortVersionString</key><string>${config.version}</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
`)
}

function archive(ctx) {
  const { config, outBase, log } = ctx
  const archivePath = `${outBase}.dmg`
  exec(`hdiutil create -volname ${JSON.stringify(config.name)} -srcfolder ${JSON.stringify(outBase)} -ov -format UDZO ${JSON.stringify(archivePath)}`)
  log(`archive: ${archivePath} (${formatSize(fs.statSync(archivePath).size)})`)
  return archivePath
}

module.exports = { NODE_BINARY, stripNode, assembleRuntime, writeLauncher, archive }
