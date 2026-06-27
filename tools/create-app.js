/*
 * create-app.js — scaffold a new GTK/Adwaita application that uses node-gtk.
 *
 * Driven by the CLI: `node-gtk init <directory> [options]` (alias `create`).
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

// ---------------------------------------------------------------------------
// scaffolding (pure: writes files, never installs, never exits the process)
// ---------------------------------------------------------------------------

function scaffold(opts) {
  const { dir, appName, appId, pkgName, force = false } = opts

  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0 && !force)
    throw new Error(`target directory is not empty: ${dir}\nUse --force to scaffold into it anyway.`)

  const nodeGtkVersion = `^${require('../package.json').version}`
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

const HELP = `node-gtk init — scaffold a GTK/Adwaita app that uses node-gtk

Usage:
  node-gtk init <directory> [options]
  node-gtk create <directory> [options]

Options:
  --name <name>      Human-facing app name (default: derived from <directory>)
  --app-id <id>      Reverse-DNS application id (default: com.example.<Name>)
  --no-install       Don't run \`npm install\` after scaffolding
  --force            Scaffold even if <directory> exists and is non-empty
  -h, --help         Show this help

Example:
  node-gtk init my-app --name "My App" --app-id org.example.MyApp
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

function run(argv) {
  const opts = parseArgs(argv)

  if (opts.help) { process.stdout.write(HELP); return }
  if (opts.unknown) { process.stderr.write(`node-gtk init: unknown option '${opts.unknown}'\n\n${HELP}`); process.exit(1) }
  if (!opts.dir) { process.stderr.write(`node-gtk init: missing <directory>\n\n${HELP}`); process.exit(1) }

  const dir = path.resolve(opts.dir)
  const base = path.basename(dir)
  const appName = opts.name || toAppName(base)
  const pkgName = toPkgName(base)
  const appId = opts.appId || toAppId(appName)

  if (!isValidAppId(appId)) {
    process.stderr.write(`node-gtk init: invalid --app-id '${appId}'.\n` +
      `It must be reverse-DNS, e.g. com.example.MyApp (2+ segments, each starting with a letter).\n`)
    process.exit(1)
  }

  let written
  try {
    written = scaffold({ dir, appName, appId, pkgName, force: opts.force })
  } catch (err) {
    process.stderr.write(`node-gtk init: ${err.message}\n`)
    process.exit(1)
  }

  process.stdout.write(`\nScaffolded ${appName} in ${dir}\n`)
  for (const f of written) process.stdout.write(`  create ${f}\n`)

  const rel = path.relative(process.cwd(), dir) || '.'

  if (opts.install) {
    process.stdout.write(`\nInstalling dependencies (npm install)…\n\n`)
    const res = child_process.spawnSync('npm', ['install'], { cwd: dir, stdio: 'inherit' })
    if (res.status !== 0) {
      process.stderr.write(
        `\nnpm install did not complete cleanly. Your project is scaffolded — ` +
        `finish setup manually:\n\n  cd ${rel}\n  npm install\n  npm run dev\n\n` +
        `(Type generation needs the GTK 4 / libadwaita typelibs — see the project README.)\n`)
      process.exit(res.status || 1)
    }
  }

  process.stdout.write(
    `\nDone! Next steps:\n\n  cd ${rel}\n` +
    (opts.install ? '' : '  npm install\n') +
    `  npm run dev\n\n`)
}

module.exports = { run, scaffold, toAppName, toPkgName, toAppId, isValidAppId }
