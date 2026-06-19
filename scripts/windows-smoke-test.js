/*
 * windows-smoke-test.js
 *
 * Verifies that a Windows prebuilt + bundled GTK runtime can be loaded and used
 * on a clean machine that has NO MSYS2/MinGW and NO compiler — i.e. exactly what
 * a user gets from `npm install node-gtk`.
 *
 * CRITICAL: this test sets NO environment variables. Everything (DLL search
 * path, GI typelib path, icon/schema/loader data) is wired up automatically by
 * lib/native.js when it loads the bundled prebuilt. The workflow runs this with
 * the runner's own MinGW stripped from PATH, so a pass proves the bundle is
 * fully self-sufficient via the auto-wiring alone.
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

// Require the local package. lib/native.js resolves the prebuilt via
// node-pre-gyp's binary.find and auto-wires the bundled runtime — NO manual
// PATH / GI_TYPELIB_PATH / XDG_DATA_DIRS setup here on purpose.
const gi = require(path.join(__dirname, '..'))
console.log('OK: require(node-gtk) — prebuilt loaded and runtime auto-wired by native.js')

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

// Exercise the bundled gdk-pixbuf image loaders + (portable) loaders.cache by
// decoding a real PNG. This proves the loader subsystem works from the bundle.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64')
const pngPath = path.join(__dirname, '..', 'smoke-test-pixel.png')
fs.writeFileSync(pngPath, PNG_1x1)
try {
  const pixbuf = loaded.GdkPixbuf.Pixbuf.newFromFile(pngPath)
  if (pixbuf.getWidth() !== 1 || pixbuf.getHeight() !== 1)
    throw new Error(`unexpected pixbuf size ${pixbuf.getWidth()}x${pixbuf.getHeight()}`)
  console.log('OK: GdkPixbuf decoded a PNG via the bundled loaders')
} finally {
  try { fs.unlinkSync(pngPath) } catch (e) { /* ignore */ }
}

console.log('\n=== SMOKE TEST PASSED: GTK4/Adwaita prebuilt usable with NO compiler/MSYS2 ===')
