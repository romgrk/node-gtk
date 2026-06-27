/*
 * create-app.js — create a new GTK/Adwaita application that uses node-gtk.
 *
 * Driven by the CLI: `node-gtk create <directory> [options]`.
 * Copies the template tree in tools/templates/app/, substitutes a few tokens
 * (app name, app id, package name, node-gtk version), and — unless --no-install
 * is passed — runs `npm install` in the new directory (which in turn generates
 * the TypeScript types via the project's postinstall script).
 */

const fs = require('fs')
const path = require('path')
const child_process = require('child_process')

const TEMPLATE_DIR = path.join(__dirname, 'templates', 'app')

// template file -> destination path (relative to the new project root).
// Templates carry a `.tmpl` suffix so npm never rewrites `.gitignore` to
// `.npmignore` and never treats a nested `package.json` as a real manifest.
const FILES = [
  ['package.json.tmpl', 'package.json'],
  ['tsconfig.json.tmpl', 'tsconfig.json'],
  ['gitignore.tmpl', '.gitignore'],
  ['README.md.tmpl', 'README.md'],
  ['style.css.tmpl', 'style.css'],
  ['src/main.ts.tmpl', path.join('src', 'main.ts')],
  ['src/welcome.ts.tmpl', path.join('src', 'welcome.ts')],
]

// ---------------------------------------------------------------------------
// name derivation
// ---------------------------------------------------------------------------

// A human-facing title: "my-cool-app" / "my_cool_app" -> "My Cool App".
function toAppName(base) {
  return base
    .replace(/[-_.\s]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'My App'
}

// A valid npm package name: lowercase, url-safe.
function toPkgName(base) {
  const name = base
    .toLowerCase()
    .replace(/[^a-z0-9-_.]+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
  return name || 'gtk-app'
}

// A reverse-DNS application id: "My Cool App" -> "com.example.MyCoolApp".
function toAppId(appName) {
  const suffix = appName
    .replace(/[^A-Za-z0-9 ]+/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('') || 'App'
  return `com.example.${suffix}`
}

// GApplication ids must look like reverse-DNS: 2+ dot-separated segments, each
// starting with a letter, containing only [A-Za-z0-9_-] (and no trailing dot).
function isValidAppId(id) {
  return /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z][A-Za-z0-9_-]*)+$/.test(id)
}

// The `node-gtk` dependency to write into the generated package.json.
//
// The created app uses the `gi:` import scheme and `node-gtk/register`, which
// exist only in this node-gtk. When run from a normal install we depend on the
// matching published version (`^x.y.z`). But when run from a *source checkout*
// (a contributor testing `node bin/node-gtk.js create`), `^x.y.z` would resolve
// to the published release — which may predate these features — so we instead
// point the app at the local checkout via `file:`, so it uses the exact node-gtk
// it was created with.
function nodeGtkDependency() {
  const repoRoot = path.resolve(__dirname, '..')
  const version = require('../package.json').version
  const isInstalled = repoRoot.split(path.sep).includes('node_modules')
  return isInstalled ? `^${version}` : `file:${repoRoot}`
}

// ---------------------------------------------------------------------------
// project creation (pure: writes files, never installs, never exits the process)
// ---------------------------------------------------------------------------

function createProject(opts) {
  const { dir, appName, appId, pkgName, force = false } = opts

  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0 && !force)
    throw new Error(`target directory is not empty: ${dir}\nUse --force to write into it anyway.`)

  const nodeGtkVersion = opts.nodeGtkVersion || nodeGtkDependency()
  const tokens = {
    __APP_NAME__: appName,
    __APP_ID__: appId,
    __PKG_NAME__: pkgName,
    __NODE_GTK_VERSION__: nodeGtkVersion,
  }
  const substitute = (s) =>
    s.replace(/__APP_NAME__|__APP_ID__|__PKG_NAME__|__NODE_GTK_VERSION__/g, (m) => tokens[m])

  const written = []
  for (const [src, dest] of FILES) {
    const content = substitute(fs.readFileSync(path.join(TEMPLATE_DIR, src), 'utf8'))
    const destPath = path.join(dir, dest)
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.writeFileSync(destPath, content)
    written.push(dest)
  }
  return written
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

const HELP = `node-gtk create — create a GTK/Adwaita app that uses node-gtk

Usage:
  node-gtk create <directory> [options]

Options:
  --name <name>      Human-facing app name (default: derived from <directory>)
  --app-id <id>      Reverse-DNS application id (default: com.example.<Name>)
  --no-install       Don't run \`npm install\` after creating the project
  --force            Create into <directory> even if it exists and is non-empty
  -h, --help         Show this help

Example:
  node-gtk create my-app --name "My App" --app-id org.example.MyApp
`

function parseArgs(argv) {
  const opts = { install: true, force: false }
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '-h': case '--help': opts.help = true; break
      case '--no-install': opts.install = false; break
      case '--force': opts.force = true; break
      case '--name': opts.name = argv[++i]; break
      case '--app-id': opts.appId = argv[++i]; break
      default:
        if (arg.startsWith('--name=')) opts.name = arg.slice('--name='.length)
        else if (arg.startsWith('--app-id=')) opts.appId = arg.slice('--app-id='.length)
        else if (arg.startsWith('-')) { opts.unknown = arg }
        else positional.push(arg)
    }
  }
  opts.dir = positional[0]
  return opts
}

// Minimal ANSI styling (chalk is only a devDependency, so we can't use it at
// runtime). No-ops when stdout isn't a TTY or NO_COLOR is set.
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
const ansi = (open, close) => (s) => useColor ? `\x1b[${open}m${s}\x1b[${close}m` : s
const bold = ansi(1, 22)
const dim = ansi(2, 22)
const cyan = ansi(36, 39)
const green = ansi(32, 39)

function run(argv) {
  const opts = parseArgs(argv)

  if (opts.help) { process.stdout.write(HELP); return }
  if (opts.unknown) { process.stderr.write(`node-gtk create: unknown option '${opts.unknown}'\n\n${HELP}`); process.exit(1) }
  if (!opts.dir) { process.stderr.write(`node-gtk create: missing <directory>\n\n${HELP}`); process.exit(1) }

  const dir = path.resolve(opts.dir)
  const base = path.basename(dir)
  const appName = opts.name || toAppName(base)
  const pkgName = toPkgName(base)
  const appId = opts.appId || toAppId(appName)

  if (!isValidAppId(appId)) {
    process.stderr.write(`node-gtk create: invalid --app-id '${appId}'.\n` +
      `It must be reverse-DNS, e.g. com.example.MyApp (2+ segments, each starting with a letter).\n`)
    process.exit(1)
  }

  let written
  try {
    written = createProject({ dir, appName, appId, pkgName, force: opts.force })
  } catch (err) {
    process.stderr.write(`node-gtk create: ${err.message}\n`)
    process.exit(1)
  }

  // Shortest copy-pasteable path to the new project: the relative path unless it
  // escapes the cwd (e.g. `../../tmp/app`), in which case the absolute path reads
  // better.
  const relPath = path.relative(process.cwd(), dir)
  const rel = (!relPath || relPath.startsWith('..')) ? dir : relPath

  process.stdout.write(`\n${green('✓')} ${bold(`Created ${appName}`)} ${dim(`(${written.length} files) in ${dir}`)}\n`)

  if (opts.install) {
    process.stdout.write(`${dim('…')} ${bold('Installing dependencies')}${dim(' (npm install)')}\n`)
    // Capture output and surface it only on failure — keep the happy path quiet.
    const res = child_process.spawnSync('npm', ['install'], { cwd: dir, encoding: 'utf8' })
    if (res.status !== 0) {
      if (res.stdout) process.stderr.write(res.stdout)
      if (res.stderr) process.stderr.write(res.stderr)
      process.stderr.write(
        `\nnpm install did not complete cleanly. Your project is created — ` +
        `finish setup manually:\n\n  cd ${rel}\n  npm install\n  npm run dev\n\n` +
        `(Type generation needs the GTK 4 / libadwaita typelibs — see the project README.)\n`)
      process.exit(res.status || 1)
    }
  }

  process.stdout.write(`${green('✓')} ${bold('Done!')}\n`)

  const steps = [`cd ${rel}`].concat(opts.install ? [] : ['npm install']).concat(['npm run dev'])
  process.stdout.write(`\n${bold('Next steps:')}\n\n`)
  for (const s of steps) process.stdout.write(`  ${cyan(s)}\n`)
  process.stdout.write('\n')
}

module.exports = { run, createProject, nodeGtkDependency, toAppName, toPkgName, toAppId, isValidAppId }
