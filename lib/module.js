/*
 * module.js
 */

const fs = require('fs')
const util = require('util')
const readdir = util.promisify(fs.readdir)

const internal = require('./native.js')
const { GI, makeInfo, getInfoName } = require('./bootstrap.js')

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

  const module = moduleCache[ns] = Object.create(null)

  const repo = GI.Repository_get_default()
  GI.Repository_require.call(repo, ns, version || null, 0)
  version = version || GI.Repository_get_version.call(repo, ns)

  loadDependencies(ns, version)

  const nInfos = GI.Repository_get_n_infos.call(repo, ns);
  for (let i = 0; i < nInfos; i++) {
    const info = GI.Repository_get_info.call(repo, ns, i);
    const item = makeInfo(info);

    if (item !== undefined)
      module[getInfoName(info)] = item
  }

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
  const namespace = moduleCache[ns] || (moduleCache[ns] = Object.create(null));
  version = version || null;

  if (namespace[version])
    return true;

  if (version == null && namespace.length > 0)
    return true;

  return false;
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
  const [name, version] = filename.replace('.typelib', '').split('-')
  return { name, version }
}
