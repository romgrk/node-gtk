/*
 * index.js
 */

const internal = require('./native.js')
const moduleCache = internal.GetModuleCache()

// Must be loaded first, to setup the GI functions
const bootstrap = require('./bootstrap.js')
const module_ = require('./module.js')
require('./loop.js') // installs the automatic main-loop integration
const registerClass = require('./register-class.js')

/**
 * Returns the GType (as a BigInt) of a GObject/boxed class, an instance of one,
 * or a GType passed through as-is. See #286.
 *
 * @param {Function|object|bigint} value a class, an instance, or a GType
 * @returns {bigint} the associated GType
 */
function getGType(value) {
  if (typeof value === 'bigint')
    return value

  if (value != null) {
    // A class: the GType lives on its prototype.
    if (typeof value === 'function' && value.prototype != null && value.prototype.__gtype__ !== undefined)
      return value.prototype.__gtype__

    // An instance (or prototype).
    if (value.__gtype__ !== undefined)
      return value.__gtype__
  }

  throw new TypeError('getGType: expected a GObject/boxed class, instance, or GType')
}

/*
 * Exports
 */

module.exports = {
  // Public API
  ...module_,
  registerClass: registerClass,
  flushRegistrations: registerClass.flushPending,
  getGType: getGType,
  System: internal.System,

  // Private API
  _cache: moduleCache,
  _GIRepository: bootstrap.GI,
  _InfoType: bootstrap.GI.InfoType,
}

