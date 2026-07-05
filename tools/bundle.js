/*
 * bundle.js — create a self-contained, double-clickable bundle of a node-gtk
 * application: the app's code, a node runtime, the compiled node-gtk addon,
 * and the whole GTK runtime it needs (shared libraries, GI typelibs,
 * GSettings schemas, icon themes, gdk-pixbuf loaders). The result runs on
 * machines with no node, no GTK and no compiler installed.
 *
 * Driven by the CLI: `node-gtk bundle [app-directory] [options]`.
 *
 * Output layout (same shape on every platform; macOS wraps it in an .app):
 *
 *   <Name>            launcher — wires the runtime environment, execs node
 *   runtime/          node binary + GTK runtime; identical across apps that
 *                     share a node-gtk/GTK version (shareable, see docs)
 *   app/              the application: its files + production node_modules
 *   bundle.json       manifest (name, id, versions, launcher path)
 *
 * Configured from the app's package.json under the "bundle" key; every field
 * is optional. See doc/bundling.md for the reference.
 */

const fs = require('fs')
const path = require('path')

const { exists, mkdirp, formatSize, dirSize, tryExec } = require('./bundle/util.js')
const appTree = require('./bundle/app-tree.js')

// macOS and Windows are planned; the per-platform work is isolated here (a
// module provides NODE_BINARY, assembleRuntime, writeLauncher, archive).
// Windows closure logic to port already exists in scripts/windows-bundle-runtime.sh.
const PLATFORMS = {
  linux: () => require('./bundle/platform-linux.js'),
}

const HELP = `Usage: node-gtk bundle [app-directory] [options]

Creates a self-contained bundle of a node-gtk application for the current
platform: app code + node runtime + node-gtk + the GTK runtime it needs.

Options:
  --out <dir>      output directory (default: <app>/dist/<name>-<platform>-<arch>)
  --name <name>    app name (default: "bundle.name" in package.json, or derived)
  --entry <file>   entry point (default: "bundle.entry", or "main" in package.json)
  --archive        also produce a compressed archive (.tar.gz / .dmg / .zip)
  -h, --help       show this help

Configuration (package.json "bundle" key — all optional):
  name, id, entry, include, nodeArgs, libraries, omitPackages, icons, out

See doc/bundling.md for the full reference and per-platform notes.`

function run(argv) {
  try {
    const flags = parseArgs(argv)
    if (flags.help) {
      console.log(HELP)
      return
    }
    const platformModule = PLATFORMS[process.platform]
    if (platformModule === undefined)
      throw new Error(`only Linux is supported for now (macOS and Windows are planned) — cannot bundle on '${process.platform}'`)
    bundle(flags, platformModule())
  } catch (e) {
    console.error(`node-gtk bundle: ${e.message}`)
    if (process.env.NODE_GTK_BUNDLE_DEBUG)
      console.error(e.stack)
    process.exit(1)
  }
}

function bundle(flags, platform) {
  const appDir = path.resolve(flags.appDir || '.')
  const config = loadConfig(appDir, flags)
  const outBase = config.out
  const log = message => console.log(message.startsWith(' ') ? message : `  ${message}`)

  console.log(`## Bundling ${config.name} (${config.id}) for ${process.platform}-${process.arch}`)

  prepareOutput(outBase)

  const ctx = {
    config, appDir, outBase, log,
    bindingName: `node-v${process.versions.modules}-${process.platform}-${process.arch}`,
  }
  if (process.platform === 'darwin') {
    ctx.contentsDir = path.join(outBase, `${config.name}.app`, 'Contents')
    ctx.runtimeDir = path.join(ctx.contentsDir, 'Resources', 'runtime')
    ctx.appOutDir = path.join(ctx.contentsDir, 'Resources', 'app')
  } else {
    ctx.runtimeDir = path.join(outBase, 'runtime')
    ctx.appOutDir = path.join(outBase, 'app')
  }
  mkdirp(ctx.runtimeDir)
  mkdirp(ctx.appOutDir)

  console.log('## Copying application')
  ctx.bindingPath = appTree.copyApp(ctx).bindingPath

  console.log('## Assembling GTK runtime')
  platform.assembleRuntime(ctx)

  // The node that runs the bundler is the node that ships (they must agree:
  // the addon was built for this ABI). `bundle.node` overrides the source
  // binary, for shipping a node built against an older glibc than the build
  // machine's — its ABI must still match.
  const nodeSrc = config.node !== undefined ? path.resolve(appDir, config.node) : process.execPath
  const nodeDest = path.join(ctx.runtimeDir, platform.NODE_BINARY)
  fs.copyFileSync(nodeSrc, nodeDest)
  fs.chmodSync(nodeDest, 0o755)
  // Distro node binaries carry debug symbols (Arch's is ~140MB, ~110MB of it
  // symbols); strip the shipped copy, like ci.sh strips the prebuilt addon.
  tryExec(`strip --strip-unneeded ${JSON.stringify(nodeDest)}`)
  log(`node: ${process.version} (${formatSize(fs.statSync(nodeDest).size)})`)

  const launcherPath = platform.writeLauncher(ctx)

  fs.writeFileSync(path.join(outBase, 'bundle.json'), JSON.stringify({
    name: config.name,
    id: config.id,
    version: config.version,
    launcher: path.relative(outBase, launcherPath),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    nodeGtk: require('../package.json').version,
    created: new Date().toISOString(),
  }, null, 2) + '\n')

  reportSizes(ctx)

  if (flags.archive)
    platform.archive(ctx)

  console.log(`## Done: ${path.relative(process.cwd(), launcherPath)}`)
}

// ---------------------------------------------------------------------------
// configuration
// ---------------------------------------------------------------------------

function loadConfig(appDir, flags) {
  const pkgPath = path.join(appDir, 'package.json')
  if (!exists(pkgPath))
    throw new Error(`no package.json in ${appDir}`)
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const raw = pkg.bundle || {}

  const name = flags.name || raw.name || pascalCase(pkg.name || 'App')
  const entry = flags.entry || raw.entry || pkg.main
  if (typeof entry !== 'string' || entry === '')
    throw new Error(`no entry point — set "main" or "bundle.entry" in package.json`)
  if (!exists(path.join(appDir, entry)))
    throw new Error(`entry point not found: ${entry}`)

  const flatpakRaw = raw.flatpak || {}
  const config = {
    name,
    id: raw.id || `com.example.${name}`,
    version: pkg.version || '0.0.0',
    summary: raw.summary || `The ${name} application`,
    license: raw.license || pkg.license,
    icon: raw.icon,
    categories: raw.categories || ['GTK'],
    gtk: raw.gtk,
    entry: path.normalize(entry),
    include: raw.include || ['**/*'],
    // The `gi:` import scheme (the default in `node-gtk create` apps) only
    // works with the loader hooks registered, so launchers pass
    // `--import node-gtk/register` unless explicitly disabled. Harmless for
    // CJS apps: register.mjs only installs hooks.
    register: raw.register !== false,
    nodeArgs: raw.nodeArgs || [],
    libraries: raw.libraries || [],
    omitPackages: raw.omitPackages || [],
    icons: raw.icons !== false,
    node: raw.node,
    out: path.resolve(appDir, flags.out || raw.out
      || path.join('dist', `${name}-${process.platform}-${process.arch}`)),
    flatpak: {
      runtimeVersion: String(flatpakRaw.runtimeVersion || '49'),
      node: Number(flatpakRaw.node || defaultFlatpakNode()),
      finishArgs: flatpakRaw.finishArgs || [],
    },
  }

  if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(config.name))
    throw new Error(`invalid bundle name '${config.name}' (it becomes a file name)`)
  return config
}

// The org.freedesktop.Sdk.Extension.node<N> major to build/run with: the
// running node's major when an extension exists for it.
function defaultFlatpakNode() {
  const major = Number(process.versions.node.split('.')[0])
  return [20, 22, 24, 26].includes(major) ? major : 24
}

function pascalCase(base) {
  return base
    .replace(/^@.*\//, '')
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join('') || 'App'
}

// Refuse to delete a directory we did not create: a previous output is
// recognized by its bundle.json manifest (or by being empty).
function prepareOutput(outBase) {
  if (exists(outBase)) {
    const isBundle = exists(path.join(outBase, 'bundle.json'))
    const isEmpty = fs.readdirSync(outBase).length === 0
    if (!isBundle && !isEmpty)
      throw new Error(`output directory ${outBase} exists and is not a previous bundle — refusing to overwrite`)
    fs.rmSync(outBase, { recursive: true, force: true })
  }
  mkdirp(outBase)
}

function reportSizes(ctx) {
  const { runtimeDir, appOutDir } = ctx
  console.log('## Size breakdown')
  const row = (label, size) => console.log(`  ${label.padEnd(26)} ${formatSize(size)}`)
  row('runtime: libraries', dirSize(path.join(runtimeDir, 'lib')) - dirSize(path.join(runtimeDir, 'lib', 'girepository-1.0')))
  row('runtime: typelibs', dirSize(path.join(runtimeDir, 'lib', 'girepository-1.0')))
  row('runtime: share (icons, ...)', dirSize(path.join(runtimeDir, 'share')))
  row('runtime: node', dirSize(path.join(runtimeDir, 'node')) + dirSize(path.join(runtimeDir, 'node.exe')))
  row('app', dirSize(appOutDir))
  row('TOTAL', dirSize(ctx.outBase))
}

// ---------------------------------------------------------------------------
// argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '-h': case '--help': flags.help = true; break
      case '--archive': flags.archive = true; break
      case '--out': flags.out = argv[++i]; break
      case '--name': flags.name = argv[++i]; break
      case '--entry': flags.entry = argv[++i]; break
      default:
        if (arg.startsWith('-'))
          throw new Error(`unknown option '${arg}' — see node-gtk bundle --help`)
        if (flags.appDir !== undefined)
          throw new Error(`unexpected argument '${arg}'`)
        flags.appDir = arg
    }
  }
  return flags
}

module.exports = { run, loadConfig, prepareOutput }
