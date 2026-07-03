/*
 * native.js
 */

const path = require('path')
const fs = require('fs')

// Resolve the compiled addon directly rather than through node-pre-gyp:
// requiring node-pre-gyp costs ~16ms of startup for what amounts to
// evaluating the module_path template of package.json (`binary.find`). Keep
// it as a fallback for any layout the shorthand doesn't cover (e.g. a
// non-node runtime with a different ABI naming scheme).
const bindingName = `node-v${process.versions.modules}-${process.platform}-${process.arch}`
let bindingPath = path.join(__dirname, 'binding', bindingName, 'node_gtk.node')

if (!fs.existsSync(bindingPath)) {
  const binary = require('@mapbox/node-pre-gyp')
  const packagePath = path.resolve(path.join(__dirname, '../package.json'))
  bindingPath = binary.find(packagePath)
}

// On Windows, the prebuilt binary ships with its whole GTK runtime bundled in
// the same directory as the .node (DLLs, GObject-Introspection typelibs, and
// runtime data). Wire the process environment to that bundle BEFORE the addon
// is loaded, so a plain `npm install node-gtk` works with no MSYS2, no compiler
// and no manual PATH setup. Done in this file specifically because it must run
// before `require(bindingPath)` (the addon's DLL imports are resolved at load
// time) and before bootstrap.js requires the GIRepository typelib.
if (process.platform === 'win32')
  setupBundledRuntime(path.dirname(bindingPath))

function setupBundledRuntime(bundleDir) {
  // A self-contained prebuilt always bundles its typelibs; if that marker is
  // absent the addon was built from source against a system GTK, so leave the
  // environment alone.
  const typelibDir = path.join(bundleDir, 'girepository-1.0')
  if (!fs.existsSync(typelibDir))
    return

  const prepend = (name, value) => {
    const cur = process.env[name]
    process.env[name] = cur ? value + path.delimiter + cur : value
  }
  const exists = p => { try { return fs.existsSync(p) } catch (e) { return false } }

  // 1) DLLs — both the addon's own imports and the namespace shared libraries
  //    GObject-Introspection loads at runtime via g_module_open().
  prepend('PATH', bundleDir)

  // 2) GI typelibs.
  prepend('GI_TYPELIB_PATH', typelibDir)

  // 3) Runtime data: icon themes, GtkSourceView languages/styles, schemas.
  const share = path.join(bundleDir, 'share')
  if (exists(share))
    prepend('XDG_DATA_DIRS', share)
  const schemas = path.join(share, 'glib-2.0', 'schemas')
  if (exists(schemas) && !process.env.GSETTINGS_SCHEMA_DIR)
    process.env.GSETTINGS_SCHEMA_DIR = schemas

  // 4) gdk-pixbuf image loaders (made path-portable at bundle time). The
  //    loaders dir goes on PATH so g_module_open() of a bare loader name from
  //    the cache resolves.
  const loadersDir = path.join(bundleDir, 'lib', 'gdk-pixbuf-2.0', '2.10.0', 'loaders')
  if (exists(loadersDir))
    prepend('PATH', loadersDir)
  const loaderCache = path.join(bundleDir, 'lib', 'gdk-pixbuf-2.0', '2.10.0', 'loaders.cache')
  if (exists(loaderCache) && !process.env.GDK_PIXBUF_MODULE_FILE)
    process.env.GDK_PIXBUF_MODULE_FILE = loaderCache
}

const binding = require(bindingPath)

module.exports = binding
