'use strict';

var gi;
try {
    gi = require('../build/Release/node-gtk');
} catch(e) {
    gi = require('../build/Debug/node-gtk');
}

const _ = require('lodash');

function toCamelCase(s) {
    return s.replace(/[_-]([a-z])/g, function (match, p1) {
        return p1.toUpperCase();
    });
}

function fromCamelCase(s) {
    return s.replace(/([a-z])([A-Z]+)/g, function (match, p1, p2) {
        return p1 + '_' + p2.toLowerCase();
    });
}

// The bootstrap from C here contains functions and methods for each object,
// namespaced with underscores. See gi.cc for more information.
var GIRepository = gi.Bootstrap();

// The GIRepository API is fairly poor, and contains methods on classes,
// methods on objects, and what should be methods interpreted as functions,
// because the scanner does not interpret methods on typedefs correctly.

// We extend this bootstrap'd repo to define all flags / enums, which
// are all we need to start declaring objects.
(function() {
    var repo = GIRepository.Repository_get_default();
    var ns = "GIRepository";

    // First, grab InfoType so we can find enums / flags.
    var InfoType = makeEnum(GIRepository.Repository_find_by_name.call(repo, ns, "InfoType"));

    // Now, define all enums / flags.
    var nInfos = GIRepository.Repository_get_n_infos.call(repo, ns);
    for (var i = 0; i < nInfos; i++) {
        var info = GIRepository.Repository_get_info.call(repo, ns, i);
        var name = GIRepository.BaseInfo_get_name.call(info);
        var type = GIRepository.BaseInfo_get_type.call(info);
        if (type === InfoType.ENUM || type === InfoType.FLAGS)
            GIRepository[name] = makeEnum(info);
    }
})();

function declareFunction(obj, info) {
    var func = gi.MakeFunction(info);
    var name = getName(info);
    var jsName = _.camelCase(name);
    var flags = GIRepository.function_info_get_flags(info);
    var is_method = ((flags & GIRepository.FunctionInfoFlags.IS_METHOD) != 0 &&
                     (flags & GIRepository.FunctionInfoFlags.IS_CONSTRUCTOR) == 0);
    var target = (is_method) ? obj.prototype : obj;
    Object.defineProperty(target, jsName, {
        configurable: true,
        writable: true,
        value: func
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

function addField(obj, fieldInfo) {
    var fieldName = getName(fieldInfo);
    // var name = _.camelCase(fieldName);
    var name = _.snakeCase(fieldName);
    Object.defineProperty(obj, name, {
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
 * Defines a GObject property on obj.
 * @param {Object} obj
 * @param {GIPropertyInfo} property
 */
function addProperty(obj, property) {
    var propertyName = getName(property);
    // var name = _.camelCase(propertyName);
    var name = _.snakeCase(propertyName);
    Object.defineProperty(obj, name, {
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
    var obj = {};
    var props = {};

    var n_values = GIRepository.enum_info_get_n_values(info);
    for (var i = 0; i < n_values; i++) {
        var valueInfo  = GIRepository.enum_info_get_value(info, i);
        var v = new Value(valueInfo);
        var name = getName(valueInfo);
        var NAME = name.toUpperCase();
        var val = GIRepository.value_info_get_value(valueInfo);
        props[NAME] = {enumerable: true, value: val};
        props[name] = {value: v};
        props[val]  = {value: NAME};
    }
    Object.defineProperties(obj, props);

    var n_methods = GIRepository.enum_info_get_n_methods(info);
    for (var i = 0; i < n_methods; i++) {
        var m_info  = GIRepository.enum_info_get_method(info, i);
        var m_func = gi.MakeFunction(m_info);
        var m_name = _.camelCase(getName(m_info));
        Object.defineProperty(obj, m_name, {
            configurable: true, writable: true, value: m_func
        });
    }

    return obj;
}

function makeObject(info) {
    var constructor = gi.MakeObjectClass(info);

    var n_methods = GIRepository.object_info_get_n_methods(info);
    for (var i = 0; i < n_methods; i++) {
        var methodInfo = GIRepository.object_info_get_method(info, i);
        declareFunction(constructor, methodInfo);
    }

    var n_properties = GIRepository.object_info_get_n_properties(info);
    for (var i = 0; i < n_properties; i++) {
        var propertyInfo = GIRepository.object_info_get_property(info, i);
        addProperty(constructor.prototype, propertyInfo);
    }

    constructor.implements = [];

    var n_interfaces = GIRepository.object_info_get_n_interfaces(info);
    for (var i = 0; i < n_interfaces; i++) {
        var i_info = GIRepository.object_info_get_interface(info, i);
        i_info.name = getName(i_info);
        constructor.implements.push(i_info);

        var i_methods = GIRepository.interface_info_get_n_methods(i_info);
        for (var j = 0; j < i_methods; j++) {
            var methodInfo = GIRepository.interface_info_get_method(i_info, j);
            declareFunction(constructor, methodInfo);
        }
    }

    var n_constants = GIRepository.object_info_get_n_constants(info);
    for (var i = 0; i < n_constants; i++) {
        var constantInfo = GIRepository.object_info_get_constant(info, i);
        var constantName = getName(constantInfo);
        var jsName = _.toUpper(constantName);
        Object.defineProperty(constructor, jsName, {
            writable: false,
            enumerable: true,
            configurable: false,
            value: makeConstant(constantInfo)
        });
    }

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

    var n_methods = GIRepository.union_info_get_n_methods(info);
    for (var i = 0; i < n_methods; i++) {
        var methodInfo = GIRepository.union_info_get_method(info, i);
        declareFunction(constructor, methodInfo);
    }

    var n_fields = GIRepository.union_info_get_n_fields(info);
    for (var i = 0; i < n_fields; i++) {
        var fieldInfo = GIRepository.union_info_get_field(info, i);
        addField(constructor.prototype, fieldInfo);
    }

    return constructor
}

function makeStruct(info) {
    var constructor = gi.MakeBoxedClass(info);

    var n_methods = GIRepository.struct_info_get_n_methods(info);
    for (var i = 0; i < n_methods; i++) {
        var methodInfo = GIRepository.struct_info_get_method(info, i);
        declareFunction(constructor, methodInfo);
    }
    var n_fields = GIRepository.struct_info_get_n_fields(info);
    for (var i = 0; i < n_fields; i++) {
        var fieldInfo = GIRepository.struct_info_get_field(info, i);
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
    for (var i = 0; i < n_properties; i++) {
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

// Used to avoid exporting same module every time it's required
var cache = Object.create(null);

function _loaded(ns, version) {
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

function gi_require(ns, version) {
    var namespace = cache[ns] || (cache[ns] = Object.create(null));
    version = version || null; // null for latest version

    if (namespace[version])
        return namespace[version]

    if (version == null && namespace.length > 0) {
        version = Object.keys(namespace)[0];
        return namespace[version];
    }

    var module = Object.create(null);
    namespace[version] = module;

    var repo = GIRepository.Repository_get_default();
    GIRepository.Repository_require.call(repo, ns, version, 0);

    var nInfos = GIRepository.Repository_get_n_infos.call(repo, ns);
    for (var i = 0; i < nInfos; i++) {
        var info = GIRepository.Repository_get_info.call(repo, ns, i);
        var name = getName(info);

        var info_res = makeInfo(info);

        if (info_res !== null && info_res !== undefined)
            module[name] = info_res;
    }

    try {
        var override = require('./overrides/' + ns);
        override.apply(module);
    } catch (e) {
        // No override
    }

    gi_load_dependencies(ns, version);

    return module;
}

function gi_load_dependencies(ns, version) {
    var repo = GIRepository.Repository_get_default();
    var dependencies = GIRepository.Repository_get_immediate_dependencies.call(repo, ns, version);

    for (var j = 0; j < dependencies.length; j++) {
        var dependency = dependencies[j].split('-');
        gi_require(dependency[0], dependency[1]);
    }
}

exports.require = gi_require;
exports._loaded = _loaded;
exports._cache = cache;

exports.c = gi;
exports.GIRepository = GIRepository;
exports.InfoType = GIRepository.InfoType;
exports.startLoop = gi.StartLoop;

exports.createElement = function (type, attrs) {
    // XXX adding children only works for objects with an 'add' method (for
    // example, GtkContainers)

    var props = {};
    var signals = {};

    for (var attr in attrs) {
        if (/^on[A-Z]/.test(attr)) {
            var signal = fromCamelCase(attr).slice(3);
            signals[signal] = attrs[attr];
        }
        else {
            props[fromCamelCase(attr)] = attrs[attr];
        }
    }

    var constr = type.bind(null, props);
    var element = new constr();

    for (signal in signals)
        element.connect(signal, signals[signal]);

    if (arguments.length > 2) {
        for (var i = 2; i < arguments.length; i++) {
            if (Array.isArray(arguments[i])) {
                arguments[i].forEach(function (item) {
                    element.add(item);
                });
            }
            else
                element.add(arguments[i]);
        }
    }

    return element;
};
