/*
 * bootstrap.js
 */

const camelCase = require('lodash.camelcase')
const internal = require('./native.js')

// The bootstrap from C here contains functions and methods for each object,
// namespaced with underscores. See gi.cc for more information.
const GI = internal.Bootstrap();
const BaseClass = internal.GetBaseClass()
const moduleCache = internal.GetModuleCache();

module.exports = {
  GI,
  makeInfo,
  getInfoName,
}

// The GIRepository API is fairly poor, and contains methods on classes,
// methods on objects, and what should be methods interpreted as functions,
// because the scanner does not interpret methods on typedefs correctly.

// We extend this bootstrap'd repo to define all flags / enums, which
// are all we need to start declaring objects.
bootstrapGIRepository(GI)

function bootstrapGIRepository(GI) {
  const repo = GI.Repository_get_default()
  const ns = 'GIRepository'

  // First, grab InfoType so we can find enums / flags.
  const InfoType = makeEnum(GI.Repository_find_by_name.call(repo, ns, 'InfoType'))

  // Now, define all enums / flags.
  const nInfos = GI.Repository_get_n_infos.call(repo, ns)
  for (let i = 0; i < nInfos; i++) {
    const info = GI.Repository_get_info.call(repo, ns, i)
    const name = GI.BaseInfo_get_name.call(info)
    const type = GI.BaseInfo_get_type.call(info)

    if (type === InfoType.ENUM || type === InfoType.FLAGS)
      GI[name] = makeEnum(info)
  }
}

// We also define GObject#on and friends, to keep NodeJS EventEmitter
// semantics. They are implemented in terms of the native .connect()
// and .disconnect() methods.
extendBaseClass(BaseClass)

function extendBaseClass(BaseClass) {
  BaseClass.prototype.on = function on(event, callback, after) {
    defineListeners(this)

    if (!this._listeners.has(event))
      this._listeners.set(event, new WeakMap())

    const fnMap = this._listeners.get(event)
    const handlerID = this.connect(event, callback, after)
    if (handlerID === 0) {
      throw new Error(`Could not connect to signal ${event}`)
    }
    fnMap.set(callback, handlerID)
    return this
  }

  BaseClass.prototype.off = function off(event, callback) {
    defineListeners(this)

    if (!this._listeners.has(event))
      return

    const fnMap = this._listeners.get(event)
    if (!fnMap.has(callback))
      return

    const handlerID = fnMap.get(callback)
    this.disconnect(handlerID)
    fnMap.delete(callback)
    return this
  }

  BaseClass.prototype.once = function once(event, callback, after) {
    const newCallback = (...args) => {
      callback(...args)
      this.off(event, newCallback)
    }
    this.on(event, newCallback, after)
    return this
  }

  BaseClass.prototype.addEventListener = BaseClass.prototype.on
  BaseClass.prototype.removeEventListener = BaseClass.prototype.off

  function defineListeners(object) {
    if (object._listeners !== undefined)
      return
    Object.defineProperty(object, '_listeners', {
      value: new Map(),
      enumerable: false,
    })
  }
}



function define(object, description) {
  const target = (description.isMethod || description.isProperty) ?
    object.prototype : object
  Object.defineProperty(target, description.name, description.property)
}

function getFunctionDescription(info) {
  const fn = internal.MakeFunction(info);
  const name = getInfoName(info);
  const flags = GI.function_info_get_flags(info);
  const isMethod =
   ((flags & GI.FunctionInfoFlags.IS_METHOD) != 0 &&
    (flags & GI.FunctionInfoFlags.IS_CONSTRUCTOR) == 0);
  return {
    name,
    isMethod,
    property: {
      configurable: true,
      writable: true,
      value: fn
    }
  }
}

function getPropertyDescription(info) {
  const propertyName = getName(info)
  const name = getInfoName(info)
  const property = {
    configurable: true,
    enumerable: true,
    get: propertyGetter(propertyName),
    set: propertySetter(propertyName),
  }
  return {name, property, isProperty: true}
}

function getConstantDescription(info) {
  const name = getInfoName(info)
  const property = {
    configurable: false,
    writable: false,
    enumerable: true,
    value: makeConstant(info)
  }
  return {name, property}
}

function addFunction(object, info) {
  define(object, getFunctionDescription(info))
}

function fieldGetter(fieldInfo) {
  return function () {
    return internal.StructFieldGetter(this, fieldInfo);
  };
}

function fieldSetter(fieldInfo) {
  return function (value) {
    return internal.StructFieldSetter(this, fieldInfo, value);
  };
}

function addField(object, fieldInfo) {
  const flags = GI.field_info_get_flags(fieldInfo)
  const writable = (flags & GI.FieldInfoFlags.WRITABLE) !== 0
  const readable = (flags & GI.FieldInfoFlags.READABLE) !== 0

  const name = getInfoName(fieldInfo)

  Object.defineProperty(object, name, {
    configurable: true,
    enumerable: readable,
    get: readable ? fieldGetter(fieldInfo) : undefined,
    set: writable ? fieldSetter(fieldInfo) : undefined
  })
}

function propertyGetter(propertyName) {
  return function () {
    return internal.ObjectPropertyGetter(this, propertyName);
  };
}

function propertySetter(propertyName) {
  return function (value) {
    return internal.ObjectPropertySetter(this, propertyName, value);
  };
}

function addProperty(object, info) {
  define(object, getPropertyDescription(info))
}

function addConstant(object, info) {
  define(object, getConstantDescription(info))
}



function makeConstant(info) {
  return internal.GetConstantValue(info)
}

function makeFunction(info) {
  return internal.MakeFunction(info)
}

function makeEnum(info) {
  const object = {}

  const nValues = GI.enum_info_get_n_values(info);
  for (let i = 0; i < nValues; i++) {
    const valueInfo = GI.enum_info_get_value(info, i);
    const valueName = getName(valueInfo).toUpperCase()
    const value = GI.value_info_get_value(valueInfo)
    Object.defineProperty(object, valueName, {
      configurable: true,
      enumerable: true,
      value: value,
    })
    Object.defineProperty(object, value, {
      configurable: true,
      enumerable: false,
      value: valueName,
    })
  }

  const nMethods = GI.enum_info_get_n_methods(info)
  for (let i = 0; i < nMethods; i++) {
    const methodInfo = GI.enum_info_get_method(info, i)
    const methodName = camelCase(getName(methodInfo))
    const method = internal.MakeFunction(methodInfo)
    Object.defineProperty(object, methodName, {
      configurable: true,
      writable: true,
      value: method
    })
  }

  return object;
}

function makeObject(info) {
  const constructor = tryCall(internal.MakeObjectClass, info);

  if (constructor instanceof Error) {
    console.warn(constructor.message)
    return null
  }

  forLoopFn(info, GI.object_info_get_n_properties, GI.object_info_get_property, (propertyInfo) => {
    addProperty(constructor, propertyInfo)
  })

  forLoopFn(info, GI.object_info_get_n_methods, GI.object_info_get_method, (methodInfo) => {
    addFunction(constructor, methodInfo);
  })

  forLoopFn(info, GI.object_info_get_n_constants, GI.object_info_get_constant, (constantInfo) => {
    addConstant(constructor, constantInfo)
  })


  /*
   * Define interface-implemented things
   */

  forLoopFn(info, GI.object_info_get_n_interfaces, GI.object_info_get_interface, (interfaceInfo) => {
    const interface_ = getInterface(interfaceInfo)

    interface_._properties.forEach(description => {
      define(constructor, description)
    })
    interface_._methods.forEach(description => {
      define(constructor, description)
    })
    interface_._constants.forEach(description => {
      define(constructor, description)
    })
  })


  return constructor;
}

function makeBoxed(info) {
  if (getType(info) == GI.InfoType.UNION) {
    return makeUnion(info)
  } else {
    return makeStruct(info)
  }
}

function makeUnion(info) {
  const constructor = internal.MakeBoxedClass(info);

  const nMethods = GI.union_info_get_n_methods(info);
  for (let i = 0; i < nMethods; i++) {
    const methodInfo = GI.union_info_get_method(info, i);
    addFunction(constructor, methodInfo);
  }

  const nFields = GI.union_info_get_n_fields(info);
  for (let i = 0; i < nFields; i++) {
    const fieldInfo = GI.union_info_get_field(info, i);
    addField(constructor.prototype, fieldInfo);
  }

  return constructor
}

function makeStruct(info) {
  const constructor = internal.MakeBoxedClass(info);

  const nMethods = GI.struct_info_get_n_methods(info);
  for (let i = 0; i < nMethods; i++) {
    var methodInfo = GI.struct_info_get_method(info, i);
    addFunction(constructor, methodInfo);
  }

  const nFields = GI.struct_info_get_n_fields(info);
  for (let i = 0; i < nFields; i++) {
    const fieldInfo = GI.struct_info_get_field(info, i);
    addField(constructor.prototype, fieldInfo);
  }

  return constructor
}

function makeInterface(info) {
  const constructor = Object.values({
    [getInfoName(info)]: function () {
      throw new Error('Cannot instantiate Interface (abstract type)')
    }
  })[0]

  /*
   * We need both to define things on the prototype for cases where we need
   * to force-assign the prototype of a returned object (eg Gtk4.FileChooserDialog),
   * and on `_properties/_methods/_constants` for `makeObject()` to re-use them.
   */

  constructor._properties = []
  forLoopFn(info, GI.interface_info_get_n_properties, GI.interface_info_get_property, (propertyInfo) => {
    constructor._properties.push(getPropertyDescription(propertyInfo))
    addProperty(constructor, propertyInfo)
  })

  constructor._methods = []
  forLoopFn(info, GI.interface_info_get_n_methods, GI.interface_info_get_method, (methodInfo) => {
    constructor._methods.push(getFunctionDescription(methodInfo))
    addFunction(constructor, methodInfo)
  })

  constructor._constants = []
  forLoopFn(info, GI.interface_info_get_n_constants, GI.interface_info_get_constant, (constantInfo) => {
    constructor._constants.push(getConstantDescription(constantInfo))
    addConstant(constructor, constantInfo)
  })

  return constructor;
}

function makeInfo(info) {
  const type = getType(info);
  /* A return value of `undefined` will not be shown
   * in the module properties. A value of `null` will. */
  switch (type) {
    case GI.InfoType.FUNCTION:
      return makeFunction(info);

    case GI.InfoType.STRUCT:
      if (GI.struct_info_is_gtype_struct(info))
        return undefined;
    // fallthrough
    case GI.InfoType.BOXED:
    case GI.InfoType.UNION:
      return makeBoxed(info);

    case GI.InfoType.ENUM:
    case GI.InfoType.FLAGS:
      return makeEnum(info);

    case GI.InfoType.OBJECT:
      return makeObject(info);

    case GI.InfoType.INTERFACE:
      return makeInterface(info);

    case GI.InfoType.CONSTANT:
      return makeConstant(info);

    // INVALID_0
    // SIGNAL
    // VFUNC
    // PROPERTY
    // FIELD
    // ARG
    // TYPE
    // UNRESOLVED
    // INVALID
    // CALLBACK
  }
}

function getInfoName(info) {
  const type = getType(info)
  const name = getName(info)

  switch (type) {
    case GI.InfoType.FUNCTION:
    case GI.InfoType.VFUNC:
      return camelCase(name) // lowerCamelCase (snake_case by default)

    case GI.InfoType.FIELD:
      return camelCase(name) // lowerCamelCase (snake_case by default)

    case GI.InfoType.PROPERTY:
      return camelCase(name) // lowerCamelCase (dash-case by default)

    case GI.InfoType.STRUCT:
    case GI.InfoType.BOXED:
    case GI.InfoType.UNION:
      return name // UpperCamelCase

    case GI.InfoType.ENUM:
    case GI.InfoType.FLAGS:
      return name // UpperCamelCase

    case GI.InfoType.OBJECT:
      return name // UpperCamelCase

    case GI.InfoType.INTERFACE:
      return name // UpperCamelCase

    case GI.InfoType.CONSTANT:
      return name // ALL_CAPS by default

    case GI.InfoType.VALUE: // enum's value
      return name.toUpperCase() // ALL_CAPS

    // INVALID_0
    // SIGNAL
    // ARG
    // TYPE
    // UNRESOLVED
    // INVALID
    // CALLBACK
  }
}

function getInterface(info) {
  const name = getInfoName(info)
  const namespace = getNamespace(info)

  if (moduleCache[namespace][name])
    return moduleCache[namespace][name]

  moduleCache[namespace][name] = makeInterface(info)
  return moduleCache[namespace][name]
}


/*
 * Helpers
 */

function getName(info) {
  return GI.BaseInfo_get_name.call(info);
}

function getNamespace(info) {
  return GI.BaseInfo_get_namespace.call(info);
}

function getType(info) {
  return GI.BaseInfo_get_type.call(info);
}

function isDeprecated(info) {
  return GI.BaseInfo_is_deprecated.call(info)
}

function deprecationWrapper(info, fn) {
  const wrapper = Object.values({
    [fn.name]: function () {
      console.log(`[node-gtk]: ${getInfoName(info)} is deprecated`)
      return fn.apply(this, arguments)
    }
  })[0]

  return wrapper
}

function forLoopFn(info, lengthFn, itemFn, fn) {
  const length = lengthFn(info)
  for (let i = 0; i < length; i++) {
    const item = itemFn(info, i)
    fn(item, i)
  }
}

function tryCall(fn, ...args) {
  try {
    return fn.apply(null, args)
  } catch (e) {
    return e
  }
}
