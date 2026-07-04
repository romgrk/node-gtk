/*
 * index.js
 */

/* GTK ≥ 4.22 defaults to the Vulkan renderer. On Linux dual-GPU laptops where
 * the only Vulkan ICD is NVIDIA's (a common Optimus setup), that renders every
 * window on the discrete GPU: window realization then wakes it from runtime
 * suspend (~1s added to first frame, on every launch once it re-suspends) and
 * pins it awake — and drawing battery — for the app's lifetime, even though the
 * display runs on the integrated GPU. The GL renderer picks the compositor's
 * device via Mesa/EGL and has none of these problems. Opt out by setting
 * GSK_RENDERER yourself (any value, including 'vulkan' or '' for GTK's choice);
 * this runs at require time, before GTK can read the variable. */
if (process.platform === 'linux' && process.env.GSK_RENDERER === undefined)
  process.env.GSK_RENDERER = 'ngl'

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
  getGType: getGType,
  System: internal.System,

  // Private API
  _cache: moduleCache,
  _GIRepository: bootstrap.GI,
  _InfoType: bootstrap.GI.InfoType,
}

