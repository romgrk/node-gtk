/*
 * register-class.js
 */

const internal = require('./native.js')
const module_ = require('./module.js')

const BaseClass = internal.GetBaseClass()
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
  const parentGtype = GObject.typeFromName(parent.name)

  if (gtype !== GObject.TYPE_INVALID)
    throw new Error(`GType name already registerd: ${name}`)

  if (parentGtype === GObject.TYPE_INVALID)
    throw new Error(`Parent class not registered registerd: ${parent.name}`)

  console.log(klass)
  console.log(getParents(klass))
  console.log([
    name,
    gtype,
    parentGtype,
  ])

  const instanceType = internal.RegisterClass(name, klass, parent.name, parent)

  klass.prototype.__gtype__ = instanceType

  console.log({ instanceType })
}

// Helpers

let nextId = 1
function createGTypeName(klass) {
  const gtypeName = klass.GTypeName

  if (gtypeName) {
    const sanitized = sanitizeGType(gtypeName);
    if (sanitized !== gtypeName)
      throw new Error(`GTypeName value is invalid: ${gtypeName}`)
    return sanitized;
  }

  return sanitizeGType(klass.name || `Anonymous${nextId++}`)
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
