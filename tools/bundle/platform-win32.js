/*
 * platform-win32.js — Windows runtime assembly.
 *
 * Bundling requires an MSYS2 MINGW64 environment (where GTK is installed and
 * node-gtk was built), running under the *Windows* node — the same setup that
 * builds node-gtk itself. The produced bundle has no such requirement: it
 * runs on a stock Windows machine.
 *
 * The DLL closure is computed with `ntldd -R` (transitive), seeded from the
 * compiled addon, the GI namespace libraries (seeds.js) and the gdk-pixbuf
 * loaders — a port of scripts/windows-bundle-runtime.sh, the logic that makes
 * the npm prebuilt self-contained (CI-proven by test-windows-prebuilt.yaml).
 * OS DLLs (System32) stay on the host; everything under the MinGW prefix
 * ships. MSVC node.exe + MinGW GTK DLLs interop fine — plain C ABI.
 *
 * The launcher is a .cmd batch file that puts runtime/lib (and the pixbuf
 * loaders dir) on PATH — the Windows DLL search path — wires the GI/GLib
 * environment, then runs the bundled node.exe on the app entry.
 */

const fs = require('fs')
const path = require('path')

const { exec, tryExec, exists, mkdirp, copyFile, formatSize } = require('./util.js')
const { seedNames } = require('./seeds.js')
const { copyTypelibs, copyRuntimeData } = require('./runtime-data.js')

const NODE_BINARY = 'node.exe'

// No stripNode: node.exe is an MSVC binary; binutils strip would only
// invalidate its signature/debug directory for no size win.

// The MinGW prefix as a Windows path (C:/msys64/mingw64). MINGW_PREFIX is the
// POSIX-style prefix exported by MSYS2 shells; cygpath converts it — and its
// availability doubles as the "are we in MSYS2?" check.
function mingwPrefix() {
  const posix = process.env.MINGW_PREFIX || '/mingw64'
  const out = tryExec(`cygpath -m ${posix}`)
  const prefix = out !== undefined ? out.trim() : ''
  if (prefix === '' || !exists(prefix))
    throw new Error('MinGW environment not found — run the bundler from an MSYS2 MINGW64 shell (with GTK installed and node-gtk built)')
  return prefix
}

function assembleRuntime(ctx) {
  const { config, runtimeDir, log } = ctx
  const prefix = mingwPrefix()
  const libDir = path.join(runtimeDir, 'lib')
  mkdirp(libDir)

  // --- typelibs ------------------------------------------------------------
  copyTypelibs(path.join(prefix, 'lib', 'girepository-1.0'),
    path.join(libDir, 'girepository-1.0'), log)

  // --- DLL closure -----------------------------------------------------------
  const seeds = []
  for (const name of seedNames('win32', config.libraries, config.gtk)) {
    const p = path.join(prefix, 'bin', name)
    if (exists(p))
      seeds.push(p)
    else
      log(`  (skip missing seed ${name})`)
  }

  const loaders = pixbufLoaders(prefix)
  const closure = ntlddClosure([ctx.bindingPath, ...seeds, ...loaders.files], prefix)

  // The seeds themselves are part of the runtime.
  for (const p of seeds)
    closure.set(path.basename(p).toLowerCase(), p)

  for (const [, src] of [...closure].sort())
    copyFile(src, path.join(libDir, path.basename(src)))
  log(`libraries: ${closure.size} DLLs bundled (OS DLLs stay on the host)`)

  // --- gdk-pixbuf loaders ---------------------------------------------------
  if (loaders.files.length > 0) {
    const loadersDst = path.join(libDir, 'gdk-pixbuf-2.0', '2.10.0', 'loaders')
    for (const file of loaders.files)
      copyFile(file, path.join(loadersDst, path.basename(file)))
    // The cache references loaders by absolute build-machine path; rewrite
    // them to bare file names — the launcher puts the loaders dir on PATH, so
    // g_module_open() resolves the bare name at run time (exactly what
    // lib/native.js + windows-bundle-runtime.sh do for the prebuilt).
    if (loaders.cache !== undefined) {
      const cache = fs.readFileSync(loaders.cache, 'utf8')
        .replace(/^"[^"]*[\\/]([^"\\/]+\.dll)"/gm, '"$1"')
      fs.writeFileSync(path.join(loadersDst, '..', 'loaders.cache'), cache)
    }
    log(`gdk-pixbuf: ${loaders.files.length} loaders`)
  }

  // --- GSettings schemas + icon themes --------------------------------------
  copyRuntimeData(ctx, path.join(prefix, 'share'))
}

// Union of the transitive DLL closures of `files`: lowercased basename ->
// source path. Only MinGW-provided DLLs are kept — anything outside the
// prefix (System32, the host node) must come from the target machine.
function ntlddClosure(files, prefix) {
  const prefixKey = normalize(prefix) + '/'
  const closure = new Map()
  for (const file of files) {
    const out = tryExec(`ntldd -R ${JSON.stringify(file)}`)
    if (out === undefined)
      continue
    for (const line of out.split('\n')) {
      const m = /=>\s+(.+?)\s+\(0x[0-9a-fA-F]+\)/.exec(line)
      if (m === null)
        continue
      const dllPath = m[1].trim()
      const key = normalize(dllPath)
      if (!key.startsWith(prefixKey))
        continue
      const name = path.basename(key)
      if (!closure.has(name))
        closure.set(name, dllPath)
    }
  }
  return closure
}

// Windows paths compare case-insensitively and ntldd mixes \ and /.
function normalize(p) {
  return p.replace(/\\/g, '/').toLowerCase()
}

function pixbufLoaders(prefix) {
  const moduleDir = path.join(prefix, 'lib', 'gdk-pixbuf-2.0', '2.10.0', 'loaders')
  if (!exists(moduleDir))
    return { files: [] }
  const files = fs.readdirSync(moduleDir)
    .filter(f => f.endsWith('.dll'))
    .map(f => path.join(moduleDir, f))
  const cache = path.join(moduleDir, '..', 'loaders.cache')
  return { files, cache: exists(cache) ? cache : undefined }
}

function writeLauncher(ctx) {
  const { config, outBase } = ctx
  const args = [...(config.register ? ['--import', 'node-gtk/register'] : []), ...config.nodeArgs]
  const nodeArgs = args.length > 0 ? args.join(' ') + ' ' : ''
  const launcherPath = path.join(outBase, `${config.name}.cmd`)
  const entry = config.entry.split(path.sep).join('\\')

  const lines = [
    '@echo off',
    `rem ${config.name} launcher - generated by \`node-gtk bundle\`.`,
    'rem Wires the bundled GTK runtime (PATH is the Windows DLL search path),',
    'rem then runs the bundled node.exe on the app entry.',
    'setlocal',
    'set "HERE=%~dp0"',
    'set "RT=%HERE%runtime"',
    'set "PATH=%RT%\\lib;%RT%\\lib\\gdk-pixbuf-2.0\\2.10.0\\loaders;%PATH%"',
    'set "GI_TYPELIB_PATH=%RT%\\lib\\girepository-1.0"',
    'set "XDG_DATA_DIRS=%RT%\\share"',
    'set "GSETTINGS_SCHEMA_DIR=%RT%\\share\\glib-2.0\\schemas"',
    'set "GDK_PIXBUF_MODULE_FILE=%RT%\\lib\\gdk-pixbuf-2.0\\2.10.0\\loaders.cache"',
    'rem Run from app\\ so bare-specifier node args (--import node-gtk/register)',
    'rem and the app\'s own relative paths resolve regardless of the invoking cwd.',
    'cd /d "%HERE%app"',
    `"%RT%\\node.exe" ${nodeArgs}".\\${entry}" %*`,
  ]
  // CRLF: cmd.exe misparses batch files with bare-LF line endings.
  fs.writeFileSync(launcherPath, lines.join('\r\n') + '\r\n')
  return launcherPath
}

function archive(ctx) {
  const { outBase, log } = ctx
  const archivePath = `${outBase}.zip`
  exec(`powershell.exe -NoProfile -Command "Compress-Archive -LiteralPath '${outBase}' -DestinationPath '${archivePath}' -Force"`)
  log(`archive: ${archivePath} (${formatSize(fs.statSync(archivePath).size)})`)
  return archivePath
}

module.exports = { NODE_BINARY, assembleRuntime, writeLauncher, archive }
