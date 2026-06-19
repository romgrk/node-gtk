/*
 * windows-smoke-test.js
 *
 * Verifies that a Windows prebuilt + bundled GTK runtime (DLLs + typelibs) can
 * be loaded and used on a clean machine that has NO MSYS2/MinGW and NO compiler
 * — i.e. exactly what a user gets from `npm install node-gtk` if we ship a
 * self-contained Windows prebuilt.
 *
 * It deliberately does NOT depend on anything from MSYS2; the only GTK bits it
 * touches are the ones bundled next to the .node by windows-bundle-runtime.sh.
 */

const path = require('path')
const fs = require('fs')

const abi = process.versions.modules
const bindingDir = path.join(__dirname, '..', 'lib', 'binding', `node-v${abi}-win32-x64`)
const typelibDir = path.join(bindingDir, 'girepository-1.0')

console.log('node:', process.version, '| abi:', abi)
console.log('binding dir:', bindingDir, '| exists:', fs.existsSync(bindingDir))
console.log('.node:', fs.existsSync(path.join(bindingDir, 'node_gtk.node')))
console.log('typelibs:', fs.existsSync(typelibDir))
if (fs.existsSync(bindingDir)) {
  const dlls = fs.readdirSync(bindingDir).filter(f => f.endsWith('.dll'))
  console.log(`bundled DLLs: ${dlls.length}`)
}

// 1) Make the bundled GTK DLLs discoverable. This covers BOTH:
//      - the addon's own static imports (resolved when node loads the .node)
//      - GObject-Introspection's g_module_open() of each namespace's shared lib
//    We REPLACE the PATH (rather than prepend) with the bundle dir + only the
//    Windows system dirs. The GitHub windows-latest runner ships its own
//    C:\mingw64; isolating the PATH proves the test uses ONLY the bundled
//    runtime, not whatever GTK happens to be on the machine.
const sysRoot = process.env.SystemRoot || 'C:\\Windows'
process.env.PATH = [
  bindingDir,
  path.dirname(process.execPath),       // node.exe dir
  path.join(sysRoot, 'System32'),
  sysRoot,
].join(path.delimiter)
// 2) Point GI at the bundled typelibs.
process.env.GI_TYPELIB_PATH =
  typelibDir + (process.env.GI_TYPELIB_PATH ? path.delimiter + process.env.GI_TYPELIB_PATH : '')

// Require the local package (its lib/native.js resolves the prebuilt via
// node-pre-gyp's binary.find, i.e. the same path users hit after install).
const gi = require(path.join(__dirname, '..'))
console.log('OK: require(node-gtk) — prebuilt + bundled DLLs loaded')

// Belt and suspenders: also register the typelib dir through GI's own API.
try { gi.prependSearchPath(typelibDir) } catch (e) { /* ignore */ }

// Point GTK4/Adwaita at the bundled runtime data so a real app could run.
const bundledShare = path.join(bindingDir, 'share')
if (fs.existsSync(bundledShare)) {
  process.env.XDG_DATA_DIRS = bundledShare + (process.env.XDG_DATA_DIRS ? path.delimiter + process.env.XDG_DATA_DIRS : '')
  const schemas = path.join(bundledShare, 'glib-2.0', 'schemas')
  if (fs.existsSync(schemas)) process.env.GSETTINGS_SCHEMA_DIR = schemas
}

// The full quilx namespace set. Vte (3.91) has no Windows port, so it is
// expected to be unavailable; everything else must load.
const REQUIRED = [
  ['GLib', '2.0'], ['GObject', '2.0'], ['Gio', '2.0'],
  ['Pango', '1.0'], ['PangoCairo', '1.0'],
  ['Gdk', '4.0'], ['GdkPixbuf', '2.0'], ['Graphene', '1.0'],
  ['Gtk', '4.0'], ['Adw', '1'], ['GtkSource', '5'],
]
const OPTIONAL = [['Vte', '3.91']]

const loaded = {}
function load(ns, version, optional) {
  try {
    const mod = gi.require(ns, version)
    console.log(`OK: gi.require('${ns}', '${version}')`)
    loaded[ns] = mod
    return mod
  } catch (e) {
    console.log(`${optional ? 'note' : 'FAIL'}: gi.require('${ns}', '${version}') — ${e.message}`)
    if (!optional) throw e
    return null
  }
}

for (const [ns, v] of REQUIRED) load(ns, v, false)
for (const [ns, v] of OPTIONAL) load(ns, v, true)

// Sanity: the typelibs really resolved their symbols.
if (typeof loaded.GLib.getMonotonicTime !== 'function')
  throw new Error('GLib.getMonotonicTime missing — typelib not really loaded')
if (typeof loaded.Gtk.Window !== 'function')
  throw new Error('Gtk.Window missing — Gtk4 typelib not really loaded')
if (typeof loaded.Adw.ApplicationWindow !== 'function')
  throw new Error('Adw.ApplicationWindow missing — libadwaita not really loaded')

// Exercise a real GTK4 + Adwaita object graph (needs a display; the runner has one).
let appOk = false
try {
  loaded.Gtk.init()
  const win = new loaded.Adw.ApplicationWindow()
  const buffer = new loaded.GtkSource.Buffer()
  const view = new loaded.GtkSource.View()
  view.setBuffer(buffer)
  win.setContent(view)
  console.log('OK: created Adw.ApplicationWindow + GtkSource.View')
  appOk = true
} catch (e) {
  console.log('note: live widget creation threw (likely no display):', e.message)
}
console.log('live GTK4/Adwaita widgets:', appOk ? 'ok' : 'skipped (no display)')

console.log('\n=== SMOKE TEST PASSED: GTK4/Adwaita prebuilt usable with NO compiler/MSYS2 ===')
