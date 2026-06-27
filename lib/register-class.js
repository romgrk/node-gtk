/*
 * register-class.js
 */

const snakeCase = require('lodash.snakecase')
const internal = require('./native.js')
const module_ = require('./module.js')
const { GI } = require('./bootstrap.js')

// Loaded lazily so that merely importing registerClass() does not force a
// GObject load — registration can be requested before the runtime is ready.
let GObject = null
function getGObject() {
  return GObject || (GObject = module_.require('GObject'))
}

/* Classes whose parent GType isn't registered yet are accumulated here and
 * retried later — see flushPending(). This lets registerClass() be called
 * before the runtime is fully initialized and makes registration
 * order-independent (a JS subclass may be registered before its superclass). */
const pending = []

/* A namespace load (gi.require) registers new GTypes, which may unblock a
 * pending registration whose parent lives in that namespace. */
module_.onRequire(flushPending)

module.exports = registerClass
module.exports.flushPending = flushPending

/**
 * Create a new GObject type. If the parent type isn't registered yet, the
 * registration is deferred and retried when the parent (or its namespace) loads.
 * @param {Class} klass - The class to register
 * @param {string} [klass.GTypeName] - The name of the GType (klass.name by default)
 * @returns {Class} the same class (so it can be assigned or used as a decorator)
 */
function registerClass(klass) {
  const GObject = getGObject()
  const parent = Object.getPrototypeOf(klass.prototype).constructor

  // Validate the conditions that can never become valid by loading more code, so
  // they stay synchronous errors (a programmer mistake, not an ordering one).
  if (!(klass.prototype instanceof GObject.Object))
    throw new Error(`Invalid base class (${parent.name})`)

  // Throws on an explicit, malformed GTypeName. Read-only: the generated name of
  // an anonymous class is assigned in tryRegister(), once, on success.
  getGTypeName(klass)

  // Register now if the parent is ready, otherwise accumulate and retry later.
  if (!tryRegister(klass))
    pending.push(klass)

  return klass
}

/**
 * Attempt to register `klass`. Returns true on success, or false if its parent
 * GType isn't registered yet (so the caller should defer the registration).
 */
function tryRegister(klass) {
  const GObject = getGObject()
  const parent = Object.getPrototypeOf(klass.prototype).constructor
  const parentName = getGTypeName(parent)
  const parentGtype = GObject.typeFromName(parentName)

  // Parent not registered yet -> defer (was the `Parent class not registered` throw).
  if (parentGtype === GObject.TYPE_INVALID)
    return false

  const name = createGTypeName(klass)
  const gtype = GObject.typeFromName(name)

  if (gtype !== GObject.TYPE_INVALID)
    throw new Error(`GType name already registerd: ${name}`)

  // Register the class with the type system
  const klassGtype = internal.RegisterClass(name, klass, parentName, parent)

  // Setup our class as the native ones are done
  klass.prototype.__gtype__ = klassGtype

  // Setup virtual functions
  setupVirtualFunctions(klass, klassGtype, parentGtype)

  // A newly-registered type may unblock pending subclasses of it.
  flushPending()

  return true
}

/**
 * Retry every deferred registration until a full pass makes no progress, so
 * chains of subclasses register regardless of the order they were requested in.
 */
function flushPending() {
  if (flushPending.running || pending.length === 0)
    return
  flushPending.running = true
  try {
    let progress = true
    while (progress) {
      progress = false
      for (let i = pending.length - 1; i >= 0; i--) {
        if (tryRegister(pending[i])) {
          pending.splice(i, 1)
          progress = true
        }
      }
    }
  } finally {
    flushPending.running = false
  }
}

// Helpers

function setupVirtualFunctions(klass, klassGtype, parentGtype) {
  const parentInfo = findInfoByGtype(parentGtype)
  if (!parentInfo)
    throw new Error(`Could not find GIR data in inheritance chain`)

  const parentPrototype = Object.getPrototypeOf(klass.prototype)

  Object.getOwnPropertyNames(klass.prototype).forEach(key => {
    if (key === 'constructor')
      return
    if (typeof klass.prototype[key] !== 'function')
      return

    const nativeName = snakeCase(key)
    const vfuncInfo = findVFunc(klassGtype, parentInfo, nativeName)

    if (!vfuncInfo)
     return

    internal.RegisterVFunc(
      vfuncInfo,
      klassGtype,
      nativeName,
      klass.prototype[key]
    )

    installParentVFunc(parentPrototype, parentGtype, key, vfuncInfo)
  })
}

/* Make `super.<vfunc>(...)` reachable from an override. The override replaces
 * the parent's implementation in the class vtable, so a JS subclass otherwise
 * has no way to call the implementation it overrode. We install, on the parent
 * GI class's prototype, a method that invokes the *parent's* native vfunc impl
 * (resolved through `parentGtype`'s vtable, not the overriding subclass's).
 *
 * Only the native boundary needs bridging: if the parent prototype already owns
 * `key` — i.e. the parent is itself a registered JS class that overrode this
 * vfunc — then `super.<vfunc>()` resolves to that JS method on its own. */
function installParentVFunc(parentPrototype, parentGtype, key, vfuncInfo) {
  if (Object.prototype.hasOwnProperty.call(parentPrototype, key))
    return

  Object.defineProperty(parentPrototype, key, {
    value: function (...args) {
      return internal.CallVFunc(vfuncInfo, parentGtype, this, args)
    },
    writable: true,
    configurable: true,
    enumerable: false,
  })
}

function findVFunc(gtype, parentInfo, name) {
  let vfuncInfo = findVFuncOnParents(parentInfo, name)
  if (!vfuncInfo) {
    vfuncInfo = findVFuncOnInterfaces(gtype, name)
  }
  return vfuncInfo
}

function findVFuncOnParents(info, name) {
  let parent = info

  /* Since it isn't possible to override a vfunc on
   * an interface without reimplementing it, we don't need
   * to search the parent types when looking for a vfunc. */
  let [vfunc, _] =
    GI.object_info_find_vfunc_using_interfaces(parent, name, null)

  if (vfunc) {
    return vfunc
  }

  while (parent) {
    vfunc = GI.object_info_find_vfunc(info, name)

    if (vfunc) {
      return vfunc
    }

    /* HACK: object_info_find_vfunc sometimes fail, so we also search for
     * the matching entry manually. */
    const n = GI.object_info_get_n_vfuncs(parent)
    for (let i = 0; i < n; i++) {
      const vfunc = GI.object_info_get_vfunc(parent, i)
      const currentName = GI.BaseInfo_get_name.call(vfunc)
      if (currentName === name) {
        return vfunc
      }
    }

    parent = GI.object_info_get_parent(parent)
  }

  return null
}

function findVFuncOnInterfaces(gtype, name) {
  const interfaces = GObject.typeInterfaces(gtype);

  for (let i = 0; i < interfaces.length; i++) {
    const interfaceInfo = findInfoByGtype(interfaces[i])

    /* The interface doesn't have to exist, it could be private
     * or dynamic. */
    if (interfaceInfo) {
      const vfunc =
        GI.interface_info_find_vfunc(interfaceInfo, name);

      if (vfunc)
        return vfunc
    }
  }

  return null
}

function findInfoByGtype(gtype) {
  let current = gtype
  while (current) {
    const info = GI.Repository_find_by_gtype.call(GI.Repository_get_default(), current)
    if (info)
      return info
    current = GObject.typeParent(current)
  }
  return null
}



function getGTypeName(klass) {
  const name =
    klass.hasOwnProperty('GTypeName') ? klass.GTypeName : klass.name

  if (name) {
    const sanitized = sanitizeGType(name);
    if (sanitized !== name)
      throw new Error(`GTypeName value is invalid: ${name}`)
    return sanitized
  }

  return undefined
}

let nextId = 1
function createGTypeName(klass) {
  const name = getGTypeName(klass)
  if (name)
    return name

  const newName = `Anonymous${nextId++}`
  klass.name = newName
  return sanitizeGType(newName)
}

function sanitizeGType(s) {
  return s.replace(/[^a-z0-9+_-]/gi, '_');
}
