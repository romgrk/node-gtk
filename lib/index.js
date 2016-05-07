'use strict';

var gi;
try {
    gi = require('../build/Release/node-gtk');
} catch(e) {
    gi = require('../build/Debug/node-gtk');
}

const _ = require('lodash');
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
    var name = GIRepository.BaseInfo_get_name.call(info);
    var flags = GIRepository.function_info_get_flags(info);
    var target = (flags & GIRepository.FunctionInfoFlags.IS_METHOD)
        ? obj.prototype
        : obj;
    var jsName = _.camelCase(name);
    Object.defineProperty(target, jsName, {
        configurable: true,
        writable: true,
        value: func
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
    var name = _.camelCase(propertyName);
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

function makeConstant(info) {
    return gi.GetConstantValue(info);
}

function makeFunction(info) {
    return gi.MakeFunction(info);
}

function makeObject(info) {
    var constructor = gi.MakeClass(info);

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
        /*var i_properties = GIRepository.interface_info_get_n_properties(i_info);
        for (var i = 0; i < i_properties; i++) {
            var propertyInfo = GIRepository.interface_info_get_property(i_info, i);
            addProperty(constructor.prototype, propertyInfo);
        }
        */
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

function makeBoxed (info) {
    var constructor = gi.MakeBoxedClass(info);
    //info.methods = {};
    //info.fields  = {};
    //var n_methods = GIRepository.struct_info_get_n_methods(info);
    //for (var i = 0; i < n_methods; i++) {
        //var methodInfo = GIRepository.struct_info_get_method(info, i);
        //var methodName = getName(methodInfo);
        //info.methods[methodName] = methodInfo;
    //}
    //var n_fields = GIRepository.union_info_get_n_fields(info);
    //for (var i = 0; i < n_fields; i++) {
        //var fieldInfo = GIRepository.union_info_get_field(info, i);
        //var fieldName = getName(fieldInfo);
        //info.fields[fieldName] = fieldInfo;
    //}
    //var n_fields = GIRepository.struct_info_get_n_fields(info);
    //for (var i = 0; i < n_fields; i++) {
        //var fieldInfo = GIRepository.struct_info_get_field(info, i);
        //var fieldName = GIRepository.BaseInfo_get_name.call(fieldInfo);
        //info.fields[fieldName] = fieldInfo;
    //}

    return constructor;
}

function makeInfo(info) {
    var type = info.getType();
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
            return;

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

function importNS(ns, version) {
    var module = {};

    var repo = GIRepository.Repository_get_default();
    GIRepository.Repository_require.call(repo, ns, version || null, 0);

    var nInfos = GIRepository.Repository_get_n_infos.call(repo, ns);
    for (var i = 0; i < nInfos; i++) {
        var info = GIRepository.Repository_get_info.call(repo, ns, i);
        var name = getName(info);
        var info_res = makeInfo(info);
        if (info_res !== null && info_res !== undefined)
            module[name] = info_res;
    }

    var override;
    try {
        override = require('./overrides/' + ns);
    } catch (e) {
        // No override
    }

    if (override)
        override.apply(module);

    return module;
}

exports.c = gi;
exports.GIRepository = GIRepository;
exports.InfoType = GIRepository.InfoType;

// Used to avoid exporting same module every time it's required
var cache = Object.create(null);
exports.importNS = function(ns, version) {
    var module = cache[ns] || (cache[ns] = {});
    var ver    = version   || '*';
    return module[ver] || (module[ver] = importNS(ns, version));
};

exports.startLoop = function() {
    gi.StartLoop();
};
