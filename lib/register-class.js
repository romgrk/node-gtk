/*
 * register-class.js
 */

const snakeCase = require('lodash.snakecase')
const internal = require('./native.js')
const module_ = require('./module.js')
const { GI } = require('./bootstrap.js')

const GObject = module_.require('GObject')

module.exports = registerClass

/**
 * Create a new GObject type
 * @param {Class} klass - The class to register
 * @param {string} [klass.GTypeName] - The name of the GType (klass.name by default)
 */
function registerClass(klass) {
  const parent = Object.getPrototypeOf(klass.prototype).constructor

  if (!(klass.prototype instanceof GObject.Object))
    throw new Error(`Invalid base class (${parent.name})`)

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
}

// Helpers

function setupVirtualFunctions(klass, klassGtype, parentGtype) {
  const parentInfo = findInfoByGtype(parentGtype)
  if (!parentInfo)
    throw new Error(`Could not find GIR data in inheritance chain`)

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
  })
}

function findVFunc(gtype, parentInfo, name) {
  let [vfuncInfo, _] = findVFuncOnParents(parentInfo, name)
  if (!vfuncInfo) {
    vfuncInfo = findVFuncOnInterfaces(gtype, name)
    // definedByParent = false
  }
  return vfuncInfo
}

function findVFuncOnParents(info, name) {
  let definedByParent = false;

  let parent = info

  /* Since it isn't possible to override a vfunc on
   * an interface without reimplementing it, we don't need
   * to search the parent types when looking for a vfunc. */
  let [vfunc, _] =
    GI.object_info_find_vfunc_using_interfaces(parent, name, null)

  do {
    if (parent)
      vfunc = GI.object_info_find_vfunc(info, name)

    parent = GI.object_info_get_parent(parent)
    definedByParent = true
  } while (!vfunc && parent)

  return [vfunc, definedByParent]
}

function findVFuncOnInterfaces(gtype, name) {
  const interfaces = GObject.typeInterfaces(gtype);

  for (i = 0; i < interfaces.length; i++) {
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

function getParents(klass) {
  const parents = []

  let current = klass
  do {
    let proto = Object.getPrototypeOf(current.prototype)
    current = proto ? proto.constructor : null
    if (!current)
      break
    parents.push(current)
  } while (current)

  return parents
}
