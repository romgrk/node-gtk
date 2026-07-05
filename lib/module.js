/*
 * module.js
 */

const fs = require('fs')
const util = require('util')
const readdir = util.promisify(fs.readdir)

const internal = require('./native.js')
const { GI, defineLazyInfos } = require('./bootstrap.js')

const moduleCache = internal.GetModuleCache();

module.exports = {
  require: giRequire,
  isLoaded,
  prependSearchPath,
  prependLibraryPath,
  listAvailableModules,
}

/**
 * Requires a module. Automatically loads dependencies.
 * @param {string} ns - namespace to load
 * @param {string} [version=null] - version to load (null for latest)
 * @returns {Object} the loaded module
 */
function giRequire(ns, version) {
  if (moduleCache[ns])
    return moduleCache[ns]

  const repo = GI.Repository_get_default()
  GI.Repository_require.call(repo, ns, version || null, 0)
  version = version || GI.Repository_get_version.call(repo, ns)

  // Cache only once the typelib is found: caching before the lookup left a
  // poisoned empty module behind on failure, and probing (try Gtk 4.0, fall
  // back to Gtk 3.0) then returned that empty module from the cache.
  const module = moduleCache[ns] = Object.create(null)

  loadDependencies(ns, version)

  // Top-level infos materialize on first access (see defineLazyInfos in
  // bootstrap.js): building every class of a namespace and its dependencies
  // eagerly used to cost ~160ms for Gtk-4.0, for the few dozen classes a
  // typical app touches.
  defineLazyInfos(module, ns)

  // Apply overrides, if present
  let override
  try { override = require.resolve(`./overrides/${[ns, version].join('-')}.js`) }
  catch (e) {
    try { override = require.resolve(`./overrides/${ns}.js`) }
    catch (e) {}
  }
  if (override)
    require(override).apply(module)

  return module
}

/**
 * Loads dependencies of a library
 */
function loadDependencies(ns, version) {
  const repo = GI.Repository_get_default()
  const dependencies = GI.Repository_get_dependencies.call(repo, ns, version)

  dependencies.forEach(dependency => {
    const [name, version] = dependency.split('-')
    giRequire(name, version)
  })
}

/**
 * Check if module version is loaded
 */
function isLoaded(ns, version) {
  // Ask the GI repository rather than the module cache: the old cache-backed
  // check inserted an empty module as a side effect (poisoning the next
  // require of the namespace) and tested a key that was never set, so it
  // always returned false.
  const repo = GI.Repository_get_default()
  return GI.Repository_is_registered.call(repo, ns, version || null)
}

/**
 * Prepends a path to GObject-Introspection search path (for typelibs)
 * @param {string} path
 */
function prependSearchPath(path) {
  GI.Repository_prepend_search_path(path)
}

/**
 * Prepends a path to GObject-Introspection library path (for shared libraries)
 * @param {string} path
 */
function prependLibraryPath(path) {
  GI.Repository_prepend_library_path(path)
}

/**
 * @typedef ModuleDescription
 * @type {object}
 * @property {string} name
 * @property {string} version
 */

/**
 * Returns a list of available modules
 * @returns {Promise<ModuleDescription[]>}
 */
function listAvailableModules() {
  const paths = GI.Repository_get_search_path()

  return Promise.all(paths.map(path =>
    readdir(path).catch(err => Promise.resolve([]))
  ))
  .then(results => results.reduce((acc, cur) => acc.concat(cur)))
  .then(filenames => filenames.filter(filename => filename.endsWith('.typelib')))
  .then(filenames => filenames.map(parseModuleFilename))
}

// Helpers

function parseModuleFilename(filename) {
  // Typelibs are named `Name-Version.typelib`; the version is the trailing
  // `-X.Y`, so split on the LAST dash — namespaces themselves may contain dashes
  // (e.g. `GUPnP-DLNA-2.0` -> name `GUPnP-DLNA`, version `2.0`).
  const base = filename.replace(/\.typelib$/, '')
  const dash = base.lastIndexOf('-')
  if (dash === -1)
    return { name: base, version: '' }
  return { name: base.slice(0, dash), version: base.slice(dash + 1) }
}
