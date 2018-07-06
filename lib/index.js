/*
 * index.js
 */

const camelCase = require('lodash.camelcase')
const snakeCase = require('lodash.snakecase')

let gi;
try {
    gi = require('../build/Release/node-gtk');
} catch(e) {
    gi = require('../build/Debug/node-gtk');
}

// The bootstrap from C here contains functions and methods for each object,
// namespaced with underscores. See gi.cc for more information.
const GIRepository = gi.Bootstrap();

// The GIRepository API is fairly poor, and contains methods on classes,
// methods on objects, and what should be methods interpreted as functions,
// because the scanner does not interpret methods on typedefs correctly.

// We extend this bootstrap'd repo to define all flags / enums, which
// are all we need to start declaring objects.
bootstrapGIRepository(GIRepository)

function bootstrapGIRepository(GIRepository) {
    const repo = GIRepository.Repository_get_default()
    const ns = 'GIRepository'

    // First, grab InfoType so we can find enums / flags.
    const InfoType = makeEnum(GIRepository.Repository_find_by_name.call(repo, ns, 'InfoType'))

    // Now, define all enums / flags.
    const nInfos = GIRepository.Repository_get_n_infos.call(repo, ns)
    for (let i = 0; i < nInfos; i++) {
        const info = GIRepository.Repository_get_info.call(repo, ns, i)
        const name = GIRepository.BaseInfo_get_name.call(info)
        const type = GIRepository.BaseInfo_get_type.call(info)

        if (type === InfoType.ENUM || type === InfoType.FLAGS)
            GIRepository[name] = makeEnum(info)
    }
}

// We also define GObject#on and friends, to keep NodeJS EventEmitter
// semantics. They are implemented in terms of the native .connect()
// and .disconnect() methods.
const GObject = gi.GetBaseClass()
extendGObject(GObject)

function extendGObject(GObject) {
    GObject.prototype.on = function on(event, callback) {
        defineListeners(this)

        if (!this._listeners.has(event))
            this._listeners.set(event, new WeakMap())

        const fnMap = this._listeners.get(event)
        const handlerID = this.connect(event, callback)
        fnMap.set(callback, handlerID)
    }

    GObject.prototype.off = function off(event, callback) {
        defineListeners(this)

        if (!this._listeners.has(event))
            return

        const fnMap = this._listeners.get(event)
        if (!fnMap.has(callback))
            return

        const handlerID = fnMap.get(callback)
        this.disconnect(handlerID)
        fnMap.delete(callback)
    }

    GObject.prototype.once = function once(event, callback) {
        const newCallback = (...args) => {
            callback(...args)
            this.off(event, newCallback)
        }
        this.on(event, newCallback)
    }

    function defineListeners(object) {
        if (object._listeners !== undefined)
            return
        Object.defineProperty(object, '_listeners', {
            value: new Map()
        })
    }
}





function addFunction(object, info) {
    const fn = gi.MakeFunction(info);
    const name = getInfoName(info);
    const flags = GIRepository.function_info_get_flags(info);
    const isMethod = ((flags & GIRepository.FunctionInfoFlags.IS_METHOD) != 0 &&
                      (flags & GIRepository.FunctionInfoFlags.IS_CONSTRUCTOR) == 0);
    const target = (isMethod) ? object.prototype : object;
    Object.defineProperty(target, name, {
        configurable: true,
        writable: true,
        value: fn
    })
}

function addVirtualFunction(object, info, implementor) {
    const fn = gi.MakeVirtualFunction(info, implementor);
    const name = getInfoName(info);
    const flags = GIRepository.function_info_get_flags(info);
    const isMethod = ((flags & GIRepository.FunctionInfoFlags.IS_METHOD) != 0 &&
                      (flags & GIRepository.FunctionInfoFlags.IS_CONSTRUCTOR) == 0);
    const target = (isMethod) ? object.prototype : object;
    Object.defineProperty(target, name, {
        configurable: true,
        writable: true,
        value: fn
    })
}

function fieldGetter(fieldInfo) {
    return function() {
        return gi.StructFieldGetter(this, fieldInfo);
    };
}

function fieldSetter(fieldInfo) {
    return function(value) {
        return gi.StructFieldSetter(this, fieldInfo, value);
    };
}

function addField(object, fieldInfo) {
    const flags = GIRepository.field_info_get_flags(fieldInfo)
    const writable = (flags & GIRepository.FieldInfoFlags.WRITABLE) !== 0
    const readable = (flags & GIRepository.FieldInfoFlags.READABLE) !== 0

    const name = getInfoName(fieldInfo)

    Object.defineProperty(object, name, {
        configurable: true,
        enumerable: readable,
        get: readable ? fieldGetter(fieldInfo) : undefined,
        set: writable ? fieldSetter(fieldInfo) : undefined
    })
}

function propertyGetter(propertyName) {
    return function() {
        return gi.ObjectPropertyGetter(this, propertyName);
    };
}

function propertySetter(propertyName) {
    return function(value) {
        return gi.ObjectPropertySetter(this, propertyName, value);
    };
}

function addProperty(object, property) {
    const propertyName = getName(property);
    const name = getInfoName(property)
    Object.defineProperty(object, name, {
        configurable: true,
        enumerable: true,
        get: propertyGetter(propertyName),
        set: propertySetter(propertyName),
    });
}

function addConstant(object, constantInfo) {
    const name = getInfoName(constantInfo)
    Object.defineProperty(object, name, {
        configurable: false,
        writable: false,
        enumerable: true,
        value: makeConstant(constantInfo)
    })
}


function makeConstant(info) {
    return gi.GetConstantValue(info)
}

function makeFunction(info) {
    return gi.MakeFunction(info)
}

function makeVirtualFunction(info, implementor) {
    return gi.MakeVirtualFunction(info, implementor)
}

function makeEnum(info) {
    const object = {}

    const nValues = GIRepository.enum_info_get_n_values(info);
    for (let i = 0; i < nValues; i++) {
        const valueInfo = GIRepository.enum_info_get_value(info, i);
        const valueName = getName(valueInfo).toUpperCase()
        const value = GIRepository.value_info_get_value(valueInfo)
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

    const nMethods = GIRepository.enum_info_get_n_methods(info)
    for (let i = 0; i < nMethods; i++) {
        const methodInfo = GIRepository.enum_info_get_method(info, i)
        const methodName = camelCase(getName(methodInfo))
        const method = gi.MakeFunction(methodInfo)
        Object.defineProperty(object, methodName, {
            configurable: true,
            writable: true,
            value: method
        })
    }

    return object;
}

function makeObject(info) {
    const constructor = gi.MakeObjectClass(info);

    loop(info, GIRepository.object_info_get_n_methods, GIRepository.object_info_get_method, (methodInfo) => {
        addFunction(constructor, methodInfo);
    })

    loop(info, GIRepository.object_info_get_n_properties, GIRepository.object_info_get_property, (propertyInfo) => {
        addProperty(constructor.prototype, propertyInfo)
    })

    loop(info, GIRepository.object_info_get_n_constants, GIRepository.object_info_get_constant, (constantInfo) => {
        addConstant(constructor, constantInfo)
    })


    /*
     * Define interface-implemented things
     */

    loop(info, GIRepository.object_info_get_n_interfaces, GIRepository.object_info_get_interface, (interfaceInfo) => {
        interfaceInfo.name = getInfoName(interfaceInfo);

        loop(interfaceInfo, GIRepository.interface_info_get_n_properties, GIRepository.interface_info_get_property, (propInfo) => {
            addProperty(constructor.prototype, propInfo);
        })

        loop(interfaceInfo, GIRepository.interface_info_get_n_methods, GIRepository.interface_info_get_method, (methodInfo) => {
            addFunction(constructor, methodInfo);
        })

        loop(interfaceInfo, GIRepository.interface_info_get_n_constants, GIRepository.interface_info_get_constant, (constantInfo) => {
            addConstant(constructor, constantInfo)
        })

        /* GIRepository.interface_info_get_n_signals
         * GIRepository.interface_info_get_signal */

        /* loop(interfaceInfo, GIRepository.interface_info_get_n_vfuncs, GIRepository.interface_info_get_vfunc, (methodInfo) => {
         *     addVirtualFunction(constructor, methodInfo, constructor.gtype);
         * }) */
    })


    return constructor;
}

function makeBoxed(info) {
    if (getType(info) == GIRepository.InfoType.UNION) {
        return makeUnion(info)
    } else {
        return makeStruct(info)
    }
}

function makeUnion(info) {
    const constructor = gi.MakeBoxedClass(info);

    const nMethods = GIRepository.union_info_get_n_methods(info);
    for (let i = 0; i < nMethods; i++) {
        const methodInfo = GIRepository.union_info_get_method(info, i);
        addFunction(constructor, methodInfo);
    }

    const nFields = GIRepository.union_info_get_n_fields(info);
    for (let i = 0; i < nFields; i++) {
        const fieldInfo = GIRepository.union_info_get_field(info, i);
        addField(constructor.prototype, fieldInfo);
    }

    return constructor
}

function makeStruct(info) {
    const constructor = gi.MakeBoxedClass(info);

    const nMethods = GIRepository.struct_info_get_n_methods(info);
    for (let i = 0; i < nMethods; i++) {
        var methodInfo = GIRepository.struct_info_get_method(info, i);
        addFunction(constructor, methodInfo);
    }

    const nFields = GIRepository.struct_info_get_n_fields(info);
    for (let i = 0; i < nFields; i++) {
        const fieldInfo = GIRepository.struct_info_get_field(info, i);
        addField(constructor.prototype, fieldInfo);
    }

    return constructor
}

function makeInterface(info) {
    const object = function() {}
    object.info = info;
    object.gtype = GIRepository.registered_type_info_get_g_type(info);
    object.properties = Object.create(null);

    const n_properties = GIRepository.interface_info_get_n_properties(info);
    for (let i = 0; i < n_properties; i++) {
        const propertyInfo = GIRepository.interface_info_get_property(info, i);
        const propertyName = getInfoName(propertyInfo);
        object.properties[propertyName] = propertyInfo;
    }

    return object;
}

function makeInfo(info) {
    const type = getType(info);
    switch (type) {
        case GIRepository.InfoType.FUNCTION:
            return makeFunction(info);

        // case GIRepository.InfoType.VFUNC:
            // return makeVirtualFunction(info, ...args);

        case GIRepository.InfoType.STRUCT:
            if (GIRepository.struct_info_is_gtype_struct(info))
                return null; // Not needed
            // else fallthrough
        case GIRepository.InfoType.BOXED:
        case GIRepository.InfoType.UNION:
            return makeBoxed(info);

        case GIRepository.InfoType.ENUM:
        case GIRepository.InfoType.FLAGS:
            return makeEnum(info);

        case GIRepository.InfoType.OBJECT:
            return makeObject(info);

        case GIRepository.InfoType.INTERFACE: // FIXME
            return makeInterface(info);

        case GIRepository.InfoType.CONSTANT:
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
        case GIRepository.InfoType.FUNCTION:
        case GIRepository.InfoType.VFUNC:
            return camelCase(name) // lowerCamelCase (snake_case by default)

        case GIRepository.InfoType.FIELD:
            return camelCase(name) // lowerCamelCase (snake_case by default)

        case GIRepository.InfoType.PROPERTY:
            return camelCase(name) // lowerCamelCase (dash-case by default)

        case GIRepository.InfoType.STRUCT:
        case GIRepository.InfoType.BOXED:
        case GIRepository.InfoType.UNION:
            return name // UpperCamelCase

        case GIRepository.InfoType.ENUM:
        case GIRepository.InfoType.FLAGS:
            return name // UpperCamelCase

        case GIRepository.InfoType.OBJECT:
            return name // UpperCamelCase

        case GIRepository.InfoType.INTERFACE:
            return name // UpperCamelCase

        case GIRepository.InfoType.CONSTANT:
            return name // ALL_CAPS by default

        case GIRepository.InfoType.VALUE: // enum's value
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


// Namespace loading

/**
 * Module cache
 */
const cache = Object.create(null);

/**
 * Require module & version. Automatically loads dependencies.
 */
function giRequire(ns, version) {
    const namespace = cache[ns] || (cache[ns] = Object.create(null))
    version = version || null // null for latest version

    if (namespace[version])
        return namespace[version]

    if (version == null && namespace.length > 0) {
        version = Object.keys(namespace)[0]
        return namespace[version]
    }

    const module = namespace[version] = Object.create(null)

    const repo = GIRepository.Repository_get_default()
    GIRepository.Repository_require.call(repo, ns, version, 0)
    version = version || GIRepository.Repository_get_version.call(repo, ns)

    const nInfos = GIRepository.Repository_get_n_infos.call(repo, ns);
    for (let i = 0; i < nInfos; i++) {
        const info = GIRepository.Repository_get_info.call(repo, ns, i);
        const item = makeInfo(info);

        if (item)
            module[getInfoName(info)] = item
    }

    try {
        const override = require(`./overrides/${[ns, version].join('-')}.js`)
        override.apply(module)
    } catch(e) {
        try {
            const override = require(`./overrides/${ns}.js`)
            override.apply(module)
        } catch(e) { /* No override */ }
    }

    loadDependencies(ns, version)

    return module
}

/**
 * Loads dependencies of a library
 */
function loadDependencies(ns, version) {
    const repo = GIRepository.Repository_get_default()
    const dependencies = GIRepository.Repository_get_immediate_dependencies.call(repo, ns, version)

    dependencies.forEach(dependency => {
        const [name, version] = dependency.split('-')
        giRequire(name, version)
    })
}

/**
 * Check if module version is loaded
 */
function _isLoaded(ns, version) {
    var namespace = cache[ns] || (cache[ns] = Object.create(null));
    version = version || null;

    if (namespace[version])
        return true;

    if (version == null && namespace.length > 0) {
        console.log(Object.keys(namespace)[0]);
        return true;
    }

    return false;
}


/*
 * Exports
 */

// Public API
exports.require = giRequire;
exports.startLoop = gi.StartLoop;

// Private API
exports._isLoaded = _isLoaded;
exports._cache = cache;
exports._c = gi;
exports._GIRepository = GIRepository;
exports._InfoType = GIRepository.InfoType;


/*
 * Helpers
 */

function getName(info) {
    return GIRepository.BaseInfo_get_name.call(info);
}

function getType (info) {
    return GIRepository.BaseInfo_get_type.call(info);
}

function loop(info, lengthFn, itemFn, fn) {
    const length = lengthFn(info)
    for (let i = 0; i < length; i++) {
        const item = itemFn(info, i)
        fn(item, i)
    }
}
