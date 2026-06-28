/*
 * list-libraries.js — list the GObject-Introspection libraries (typelibs)
 * available on this machine, grouped by namespace with their versions.
 *
 * Driven by the CLI: `node-gtk list [filter] [options]`. The names/versions it
 * prints are exactly what you pass to `require()` / the `gi:` import scheme /
 * `generate-types` (e.g. `Gtk-4.0`).
 */

const gi = require('../lib/index.js')
const GI = gi._GIRepository

// ---------------------------------------------------------------------------
// data
// ---------------------------------------------------------------------------

// Compare dotted versions numerically, ascending ("3.0" < "4.0" < "10.0"),
// falling back to a string compare for non-numeric segments.
function compareVersions(a, b) {
  const pa = a.split('.'), pb = b.split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '', y = pb[i] ?? ''
    const nx = Number(x), ny = Number(y)
    if (Number.isNaN(nx) || Number.isNaN(ny)) { if (x !== y) return x < y ? -1 : 1 }
    else if (nx !== ny) return nx - ny
  }
  return 0
}

// Group the flat [{name, version}] from listAvailableModules() into a sorted
// list of { name, versions } (names A→Z, versions ascending, deduped).
async function collect(filter) {
  const modules = await gi.listAvailableModules()
  const byName = new Map()
  for (const { name, version } of modules) {
    if (filter && !name.toLowerCase().includes(filter.toLowerCase())) continue
    if (!byName.has(name)) byName.set(name, new Set())
    if (version) byName.get(name).add(version)
  }
  return [...byName.entries()]
    .map(([name, versions]) => ({ name, versions: [...versions].sort(compareVersions) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// output
// ---------------------------------------------------------------------------

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
const ansi = (open, close) => (s) => useColor ? `\x1b[${open}m${s}\x1b[${close}m` : s
const bold = ansi(1, 22)
const dim = ansi(2, 22)
const cyan = ansi(36, 39)

function printTable(libs) {
  if (libs.length === 0) {
    process.stdout.write(`${dim('No libraries found.')}\n`)
    return
  }
  const width = libs.reduce((w, l) => Math.max(w, l.name.length), 0)
  for (const { name, versions } of libs)
    process.stdout.write(`  ${bold(name.padEnd(width))}  ${dim(versions.join(', '))}\n`)
}

// ---------------------------------------------------------------------------
// cli — `node-gtk list [filter] [options]`
// ---------------------------------------------------------------------------

const HELP = `node-gtk list — list the GObject-Introspection libraries available on this machine

Usage:
  node-gtk list [filter] [options]

Arguments:
  filter         Only show libraries whose name contains this (case-insensitive)

Options:
  --json         Output as JSON: [{ "name", "versions": [...] }]
  -h, --help     Show this help

Examples:
  node-gtk list
  node-gtk list gtk
  node-gtk list --json
`

function run(argv) {
  // Don't crash when the output is piped into a reader that closes early
  // (e.g. `node-gtk list | head`).
  process.stdout.on('error', (err) => { if (err.code === 'EPIPE') process.exit(0); throw err })

  const opts = { json: false }
  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') { process.stdout.write(HELP); return }
    else if (arg === '--json') opts.json = true
    else if (arg.startsWith('-')) { process.stderr.write(`node-gtk list: unknown option '${arg}'\n\n${HELP}`); process.exit(1) }
    else if (opts.filter === undefined) opts.filter = arg
    else { process.stderr.write(`node-gtk list: unexpected argument '${arg}'\n\n${HELP}`); process.exit(1) }
  }

  collect(opts.filter).then((libs) => {
    if (opts.json) {
      process.stdout.write(JSON.stringify(libs, null, 2) + '\n')
      return
    }

    const what = opts.filter ? `matching ${JSON.stringify(opts.filter)}` : 'available'
    process.stdout.write(`\n${bold(`${libs.length}`)} ${libs.length === 1 ? 'library' : 'libraries'} ${what}:\n\n`)
    printTable(libs)

    if (libs.length) {
      const first = libs.find(l => l.versions.length) || libs[0]
      const example = first.versions.length ? `${first.name}-${first.versions[first.versions.length - 1]}` : first.name
      process.stdout.write(`\n${dim('Use one with, e.g.:')}  ${cyan(`node-gtk generate-types ${example}`)}\n\n`)
    } else {
      const paths = (GI.Repository_get_search_path() || [])
      process.stdout.write(`\n${dim('Searched: ' + paths.join(', '))}\n`)
    }
  }).catch((err) => {
    process.stderr.write(`node-gtk list: ${err.message}\n`)
    process.exit(1)
  })
}

module.exports = { run, collect, compareVersions }
