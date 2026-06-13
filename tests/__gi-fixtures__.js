/*
 * __gi-fixtures__.js
 *
 * Helper for tests that use the gobject-introspection test libraries
 * (GIMarshallingTests, Regress). It points node-gtk at the local fixtures
 * directory (typelibs + shared libraries produced by
 * scripts/build-test-fixtures.js) and loads the requested namespace.
 *
 * If a fixture is unavailable (not built, unsupported platform), the requesting
 * test is skipped via the suite's exit-222 convention rather than failing.
 */

const fs = require('fs')
const path = require('path')
const gi = require('../lib/')
const { skip } = require('./__common__.js')

const FIXTURES_DIR = path.join(__dirname, 'gi-fixtures')

let pathsRegistered = false
function registerPaths() {
  if (pathsRegistered)
    return
  // Typelibs live here; so do the matching shared libraries that the typelibs
  // dlopen by name, so register the same dir for both search paths.
  gi.prependSearchPath(FIXTURES_DIR)
  gi.prependLibraryPath(FIXTURES_DIR)
  pathsRegistered = true
}

/**
 * Load a fixture namespace, or skip the current test if it isn't available.
 * @param {string} namespace e.g. 'GIMarshallingTests'
 * @returns {Object} the loaded module
 */
function requireFixture(namespace) {
  const typelib = path.join(FIXTURES_DIR, `${namespace}-1.0.typelib`)
  if (!fs.existsSync(typelib)) {
    console.error(
      `Fixture ${namespace} not found at ${typelib}; ` +
      `run \`node scripts/build-test-fixtures.js\`. Skipping.`)
    skip()
  }

  registerPaths()

  try {
    return gi.require(namespace)
  } catch (e) {
    console.error(`Failed to load fixture ${namespace}:`, e.message)
    skip()
  }
}

module.exports = {
  FIXTURES_DIR,
  requireFixture,
  requireGIMarshallingTests: () => requireFixture('GIMarshallingTests'),
  requireRegress: () => requireFixture('Regress'),
}
