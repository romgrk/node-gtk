/*
 * index.js
 */

const internal = require('./native.js')
const moduleCache = internal.GetModuleCache()

// Must be loaded first, to setup the GI functions
const bootstrap = require('./bootstrap.js')
const module_ = require('./module.js')
const loop = require('./loop.js')
const registerClass = require('./register-class.js')

/*
 * Exports
 */

module.exports = {
  // Public API
  ...module_,
  startLoop: loop.start,
  registerClass: registerClass,
  System: internal.System,

  // Private API
  _cache: moduleCache,
  _GIRepository: bootstrap.GI,
  _InfoType: bootstrap.GI.InfoType,
}

