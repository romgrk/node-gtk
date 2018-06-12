'use strict';

var gi;
try {
    gi = require('../build/Release/node-gtk');
} catch(e) {
    gi = require('../build/Debug/node-gtk');
}

const _ = require('lodash');

function loop(info, lengthFn, itemFn, fn) {
    const length = lengthFn(info)
    for (let i = 0; i < length; i++) {
        const item = itemFn(info, i)
        fn(item, i)
    }
}

// The bootstrap from C here contains functions and methods for each object,
// namespaced with underscores. See gi.cc for more information.
var GIRepository = gi.Bootstrap();

// The GIRepository API is fairly poor, and contains methods on classes,
// methods on objects, and what should be methods interpreted as functions,
// because the scanner does not interpret methods on typedefs correctly.

(function() {
    // We extend this bootstrap'd repo to define all flags / enums, which
    // are all we need to start declaring objects.
    const repo = GIRepository.Repository_get_default();
    const ns = 'GIRepository';

    // First, grab InfoType so we can find enums / flags.
    const InfoType = makeEnum(GIRepository.Repository_find_by_name.call(repo, ns, 'InfoType'));

    // Now, define all enums / flags.
    const nInfos = GIRepository.Repository_get_n_infos.call(repo, ns);
    for (let i = 0; i < nInfos; i++) {
        const info = GIRepository.Repository_get_info.call(repo, ns, i);
        const name = GIRepository.BaseInfo_get_name.call(info);
        const type = GIRepository.BaseInfo_get_type.call(info);

        if (type === InfoType.ENUM || type === InfoType.FLAGS)
            GIRepository[name] = makeEnum(info);
    }

    // We define GObject#on and friends, to keep nodejs semantics
    const GObject = gi.GetBaseClass()
    GObject.prototype.on = function(event, callback) {
        this._listeners = this._listeners || new Map()
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new WeakMap())
        }
        const fnMap = this._listeners.get(event)
        const handlerID = this.connect(event, callback)
        fnMap.set(callback, handlerID)
    }
    GObject.prototype.off = function(event, callback) {
        this._listeners = this._listeners || new Map()
        if (!this._listeners.has(event)) {
            return
        }
        const fnMap = this._listeners.get(event)
        const handlerID = fnMap.get(callback)
        this.disconnect(handlerID)
    }
    GObject.prototype.once = function(event, callback) {
        const newCallback = (...args) => {
            callback(...args)
            this.off(event, callback)
        }
        this.on(event, newCallback)
    }
})();


function declareFunction(object, info) {
    const fn = gi.MakeFunction(info);
    const name = getName(info);
    const jsName = _.camelCase(name);
    const flags = GIRepository.function_info_get_flags(info);
    const isMethod = ((flags & GIRepository.FunctionInfoFlags.IS_METHOD) != 0 &&
                      (flags & GIRepository.FunctionInfoFlags.IS_CONSTRUCTOR) == 0);
    const target = (isMethod) ? object.prototype : object;
    Object.defineProperty(target, jsName, {
        configurable: true,
        writable: true,
        value: fn
    });
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
    var fieldName = getName(fieldInfo);
    // var name = _.camelCase(fieldName);
    var name = _.snakeCase(fieldName);
    Object.defineProperty(object, name, {
        configurable: true,
        get: fieldGetter(fieldInfo),
        set: fieldSetter(fieldInfo)
    });
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

/**
 * Defines a GObject property on object.
 * @param {Object} object
 * @param {GIPropertyInfo} property
 */
function addProperty(object, property) {
    var propertyName = getName(property);
    // var name = _.camelCase(propertyName);
    var name = _.snakeCase(propertyName);
    Object.defineProperty(object, name, {
        get: propertyGetter(propertyName),
        set: propertySetter(propertyName),
    });
}

function getName(info) {
    return GIRepository.BaseInfo_get_name.call(info);
}

function getType (info) {
    return GIRepository.BaseInfo_get_type.call(info);
}

function Value(info) {
    Object.defineProperty(this, '_name', {value: getName(info)});
    Object.defineProperty(this, '_NAME', {value: this._name.toUpperCase()});
    Object.defineProperty(this, '_value',{value: GIRepository.value_info_get_value(info)});
}
Value.prototype.valueOf = function () {
    return this._value;
};
Value.prototype.toString = function () {
    return this._NAME;
};


function makeConstant(info) {
    return gi.GetConstantValue(info);
}

function makeFunction(info) {
    return gi.MakeFunction(info);
}

function makeEnum(info) {
    const object = {}
    const props = {}

    const nValues = GIRepository.enum_info_get_n_values(info);
    for (let i = 0; i < nValues; i++) {
        const valueInfo  = GIRepository.enum_info_get_value(info, i);
        const v = new Value(valueInfo)
        const name = getName(valueInfo)
        const NAME = name.toUpperCase()
        const val = GIRepository.value_info_get_value(valueInfo)
        props[NAME] = { enumerable: true, value: val }
        props[name] = { value: v }
        props[val]  = { value: NAME }
    }
    Object.defineProperties(object, props)

    const nMethods = GIRepository.enum_info_get_n_methods(info)
    for (let i = 0; i < nMethods; i++) {
        const methodInfo  = GIRepository.enum_info_get_method(info, i)
        const methodName = _.camelCase(getName(methodInfo))
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
        declareFunction(constructor, methodInfo);
    })

    loop(info, GIRepository.object_info_get_n_properties, GIRepository.object_info_get_property, (propertyInfo) => {
        addProperty(constructor.prototype, propertyInfo)
    })

    constructor.implements = []

    loop(info, GIRepository.object_info_get_n_interfaces, GIRepository.object_info_get_interface, (interfaceInfo) => {
        interfaceInfo.name = getName(interfaceInfo);
        constructor.implements.push(interfaceInfo);

        loop(interfaceInfo, GIRepository.interface_info_get_n_methods, GIRepository.interface_info_get_method, (methodInfo) => {
            declareFunction(constructor, methodInfo);
        })
    })

    loop(info, GIRepository.object_info_get_n_constants, GIRepository.object_info_get_constant, (constantInfo) => {
        const constantName = getName(constantInfo);
        const jsName = _.toUpper(constantName);
        Object.defineProperty(constructor, jsName, {
            writable: false,
            enumerable: true,
            configurable: false,
            value: makeConstant(constantInfo)
        });
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
    var constructor = gi.MakeBoxedClass(info);

    //if (!global.unions)
        //global.unions = [];
    //global.unions.push(constructor);

    var nMethods = GIRepository.union_info_get_n_methods(info);
    for (let i = 0; i < nMethods; i++) {
        var methodInfo = GIRepository.union_info_get_method(info, i);
        declareFunction(constructor, methodInfo);
    }

    var n_fields = GIRepository.union_info_get_n_fields(info);
    for (let i = 0; i < n_fields; i++) {
        var fieldInfo = GIRepository.union_info_get_field(info, i);
        addField(constructor.prototype, fieldInfo);
    }

    return constructor
}

function makeStruct(info) {
    const constructor = gi.MakeBoxedClass(info);

    const nMethods = GIRepository.struct_info_get_n_methods(info);
    for (let i = 0; i < nMethods; i++) {
        var methodInfo = GIRepository.struct_info_get_method(info, i);
        declareFunction(constructor, methodInfo);
    }
    const n_fields = GIRepository.struct_info_get_n_fields(info);
    for (let i = 0; i < n_fields; i++) {
        const fieldInfo = GIRepository.struct_info_get_field(info, i);
        addField(constructor.prototype, fieldInfo);
    }

    return constructor
}

function makeInterface(info) {
    var constructor = function () {};
    constructor.info = info;
    constructor.gtype = GIRepository.registered_type_info_get_g_type(info);
    constructor.properties = Object.create(null);

    var n_properties = GIRepository.interface_info_get_n_properties(info);
    for (let i = 0; i < n_properties; i++) {
        var propertyInfo = GIRepository.interface_info_get_property(info, i);
        var p_name = getName(propertyInfo);
        constructor.properties[p_name] = propertyInfo;
    }

    if (!global.interfaces)
        global.interfaces = [];
    global.interfaces.push(constructor);

    return constructor;
}

function makeInfo(info) {
    var type = getType(info);
    switch (type) {
        // INVALID
        // CALLBACK
        case GIRepository.InfoType.FUNCTION:
            return makeFunction(info);

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
        // case GIRepository.InfoType.VALUE:
        // SIGNAL
        // VFUNC
        // PROPERTY
        // FIELD
        // ARG
        // TYPE
        // UNRESOLVED
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
function gi_require(ns, version) {
    const namespace = cache[ns] || (cache[ns] = Object.create(null));
    version = version || null; // null for latest version

    if (namespace[version])
        return namespace[version]

    if (version == null && namespace.length > 0) {
        version = Object.keys(namespace)[0];
        return namespace[version];
    }

    const module = Object.create(null);
    namespace[version] = module;

    const repo = GIRepository.Repository_get_default();
    GIRepository.Repository_require.call(repo, ns, version, 0);

    const nInfos = GIRepository.Repository_get_n_infos.call(repo, ns);
    for (let i = 0; i < nInfos; i++) {
        const info = GIRepository.Repository_get_info.call(repo, ns, i);
        const name = getName(info);

        const moduleInstance = makeInfo(info);

        if (moduleInstance !== null && moduleInstance !== undefined)
            module[name] = moduleInstance
    }

    try {
        const override = require('./overrides/' + ns);
        override.apply(module);
    } catch (e) {
        // No override
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
        gi_require(name, version)
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
exports.require = gi_require;
exports.startLoop = gi.StartLoop;

// Private API
exports._isLoaded = _isLoaded;
exports._cache = cache;
exports._c = gi;
exports._GIRepository = GIRepository;
exports._InfoType = GIRepository.InfoType;
