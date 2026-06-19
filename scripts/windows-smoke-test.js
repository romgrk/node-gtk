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

function load(ns, version) {
  const mod = gi.require(ns, version)
  console.log(`OK: gi.require('${ns}', '${version}')`)
  return mod
}

const GLib = load('GLib', '2.0')
if (typeof GLib.getMonotonicTime !== 'function')
  throw new Error('GLib.getMonotonicTime missing — typelib not really loaded')
load('GObject', '2.0')
load('Gio', '2.0')
const Gtk = load('Gtk', '3.0')
if (typeof Gtk.Window !== 'function')
  throw new Error('Gtk.Window missing — Gtk typelib not really loaded')

// Gtk.init may fail without a display; that is not a binary-usability problem,
// so we report it but do not fail the smoke test on it.
let initOk = false
try { Gtk.init(); initOk = true } catch (e) { console.log('note: Gtk.init() threw:', e.message) }
console.log('Gtk.init():', initOk ? 'ok' : 'skipped/failed (no display)')

console.log('\n=== SMOKE TEST PASSED: prebuilt is usable with NO compiler/MSYS2 ===')
