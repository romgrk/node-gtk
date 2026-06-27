/*
 * register-class.js
 */

const snakeCase = require('lodash.snakecase')
const internal = require('./native.js')
const module_ = require('./module.js')
const { GI } = require('./bootstrap.js')

const GObject = module_.require('GObject')

module.exports = registerClass

// Make registerClass() optional: the first `new Subclass()` of an unregistered
// JS subclass lazily registers it through this hook (see GObjectConstructor in
// src/gobject.cc). registerClass() stays available for callers that need the
// GType before constructing (e.g. getGType, GtkBuilder templates).
internal.SetLazyClassRegister(registerClass)

// A registered class owns its `__gtype__` (native classes via the prototype
// template, JS classes via registerClass below); an unregistered subclass only
// inherits one. Used to make registration idempotent and to find ancestors that
// still need registering.
function isRegistered(klass) {
  return Object.prototype.hasOwnProperty.call(klass.prototype, '__gtype__')
}

/**
 * Create a new GObject type.
 *
 * To override a virtual function, define a method named `virtual_` + the
 * camelCase vfunc name (e.g. `virtual_sizeAllocate` overrides
 * `size_allocate`, `virtual_getRequestMode` overrides `get_request_mode`).
 * Only `virtual_*`-prefixed methods are wired into the vtable; plain methods are
 * never treated as overrides. Chain up to the parent implementation with
 * `super.virtual_sizeAllocate(...)`. See doc/index.md "Inheritance".
 *
 * @param {Class} klass - The class to register
 * @param {string} [klass.GTypeName] - The name of the GType (klass.name by default)
 * @returns {Class} the same class (so it can be assigned or used as a decorator)
 */
function registerClass(klass) {
  // Idempotent: a class that already owns a GType is registered. This also makes
  // the lazy-on-first-construct path a no-op for explicitly-registered classes.
  if (isRegistered(klass))
    return klass

  const parent = Object.getPrototypeOf(klass.prototype).constructor

  if (!(klass.prototype instanceof GObject.Object))
    throw new Error(`Invalid base class (${parent.name})`)

  // Register any unregistered ancestor first, so a subclass can be constructed
  // (or registered) without its superclass having been registered by hand.
  if (!isRegistered(parent))
    registerClass(parent)

  const name = createGTypeName(klass)
  const gtype = GObject.typeFromName(name)
  const parentName = getGTypeName(parent)
  const parentGtype = GObject.typeFromName(parentName)

  if (gtype !== GObject.TYPE_INVALID)
    throw new Error(`GType name already registerd: ${name}`)

  if (parentGtype === GObject.TYPE_INVALID)
    throw new Error(`Parent class not registered: ${parent.name}`)

  // Register the class with the type system
  const klassGtype = internal.RegisterClass(name, klass, parentName, parent)

  // Setup our class as the native ones are done
  klass.prototype.__gtype__ = klassGtype

  // Setup virtual functions
  setupVirtualFunctions(klass, klassGtype, parentGtype)

  return klass
}

// Helpers

/* Methods whose name starts with `virtual_` are treated as virtual-function
 * overrides — and *only* those. This makes overriding explicit and opt-in: a
 * plain method named `dispose`, `getProperty`, `sizeAllocate`, … can no longer
 * silently hijack the matching GObject vfunc (issue #457). The prefix also keeps
 * the override name distinct from the public invoker method of the same vfunc
 * (e.g. `widget.sizeAllocate(...)` the method vs. the `virtual_sizeAllocate`
 * override), so the two no longer collide. */
const VIRTUAL_PREFIX = /^virtual_/

/* `virtual_getRequestMode` -> `get_request_mode` (drop the prefix, snake_case the
 * rest). snakeCase('virtual_getRequestMode') === 'virtual_get_request_mode'. */
function vfuncNativeName(key) {
  return snakeCase(key).replace(/^virtual_/, '')
}

function setupVirtualFunctions(klass, klassGtype, parentGtype) {
  const parentInfo = findInfoByGtype(parentGtype)
  if (!parentInfo)
    throw new Error(`Could not find GIR data in inheritance chain`)

  const parentPrototype = Object.getPrototypeOf(klass.prototype)

  Object.getOwnPropertyNames(klass.prototype).forEach(key => {
    if (key === 'constructor')
      return
    if (!VIRTUAL_PREFIX.test(key))
      return
    if (typeof klass.prototype[key] !== 'function')
      return

    const nativeName = vfuncNativeName(key)
    const vfuncInfo = findVFunc(klassGtype, parentInfo, nativeName)

    if (!vfuncInfo)
      throw new Error(
        `${klass.name}.${key}: no virtual function '${nativeName}' on ` +
        `'${GObject.typeName(parentGtype)}' or its interfaces. A 'virtual_*' ` +
        `method must name an existing vfunc (e.g. 'virtual_sizeAllocate' for ` +
        `'size_allocate'); rename it if it is a plain method.`)

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
