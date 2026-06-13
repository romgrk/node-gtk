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
 * @param {string} namespace - namespace to load
 * @param {string} [version=null] - version to load (null for latest)
 * @returns {Object} the loaded module
 */
function giRequire(namespace, version) {
  if (moduleCache[namespace])
    return moduleCache[namespace]

  const module = moduleCache[namespace] = Object.create(null)

  const repo = GI.Repository_get_default()
  GI.Repository_require.call(repo, namespace, version || null, 0)
  version = version || GI.Repository_get_version.call(repo, namespace)

  loadDependencies(namespace, version)

  const nInfos = GI.Repository_get_n_infos.call(repo, namespace);
  for (let i = 0; i < nInfos; i++) {
    const info = GI.Repository_get_info.call(repo, namespace, i);
    const item = makeInfo(info);

    if (item !== undefined)
      module[getInfoName(info)] = item
  }

  // Apply overrides, if present
  let override
  try { override = require.resolve(`./overrides/${[namespace, version].join('-')}.js`) }
  catch (e) {
    try { override = require.resolve(`./overrides/${namespace}.js`) }
    catch (e) {}
  }
  if (override)
    require(override).apply(module)

  return module
}

/**
 * Loads dependencies of a library
 */
function loadDependencies(namespace, version) {
  const repo = GI.Repository_get_default()
  const dependencies = GI.Repository_get_dependencies.call(repo, namespace, version)

  dependencies.forEach(dependency => {
    const [name, version] = dependency.split('-')
    giRequire(name, version)
  })
}

/**
 * Check if module version is loaded
 */
function isLoaded(namespace, version) {
  const cache = moduleCache[namespace] || (moduleCache[namespace] = Object.create(null));
  version = version || null;

  if (cache[version])
    return true;

  if (version == null && cache.length > 0)
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
