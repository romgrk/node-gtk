
var _gi;
try {
    _gi = require('../build/Release/node-gtk');
} catch(e) {
    _gi = require('../build/Debug/node-gtk');
}

var _gir = _gi.Bootstrap();

var InfoType = {
    INVALID: 0,
    FUNCTION: 1,
    CALLBACK: 2,
    STRUCT: 3,
    BOXED: 4,
    ENUM: 5,
    FLAGS: 6,
    OBJECT: 7,
    INTERFACE: 8,
    CONSTANT: 9,
    INVALID_0: 10,
    UNION: 11,
    VALUE: 12,
    SIGNAL: 13,
    VFUNC: 14,
    PROPERTY: 15,
    FIELD: 16,
    ARG: 17,
    TYPE: 18,
    UNRESOLVED: 19
};

function declareFunction(obj, info) {
    var name = _gir.BaseInfo_get_name.call(info);
    var flags = _gir.function_info_get_flags(info);
    var func = _gi.MakeFunction(info);
    if (flags & 1) // method
        obj.prototype[name] = func;
    else
        obj[name] = func;
}

function makeEnum(info) {
    var obj = {};
    var nValues = _gir.enum_info_get_n_values(info);

    for (var i = 0; i < nValues; i++) {
        var valueInfo = _gir.enum_info_get_value(info, i);
        var valueName = _gir.BaseInfo_get_name.call(valueInfo);
        var valueValue = _gir.value_info_get_value(valueInfo);
        obj[valueName.toUpperCase()] = valueValue;
    }

    return obj;
}

function makeConstant(info) {
    return _gi.GetConstantValue(info);
}

function makeFunction(info) {
    return _gi.MakeFunction(info);
}

function makeObject(info) {
    function propertyGetter(propertyName) {
        return function() {
            return _gi.ObjectPropertyGetter(this, propertyName);
        };
    }
    function propertySetter(propertyName) {
        return function(value) {
            // TODO: Property setters
        };
    }

    var constructor = _gi.MakeClass(info);

    var nMethods = _gir.object_info_get_n_methods(info);
    for (var i = 0; i < nMethods; i++) {
        var methodInfo = _gir.object_info_get_method(info, i);
        declareFunction(constructor, methodInfo);
    }

    var nProperties = _gir.object_info_get_n_properties(info);
    for (var i = 0; i < nProperties; i++) {
        var propertyInfo = _gir.object_info_get_property(info, i);

        var propertyName = _gir.BaseInfo_get_name.call(propertyInfo);
        var jsPropertyName = propertyName.replace(/-/g, '_');

        Object.defineProperty(constructor.prototype, jsPropertyName, {
            enumerable: true,
            get: propertyGetter(propertyName),
            set: propertySetter(propertyName),
        });
    }

    return constructor;
}

function makeInfo(info) {
    var type = _gir.BaseInfo_get_type.call(info);

    if (type === InfoType.ENUM)
        return makeEnum(info);
    if (type === InfoType.CONSTANT)
        return makeConstant(info);
    if (type === InfoType.FUNCTION)
        return makeFunction(info);
    if (type === InfoType.OBJECT)
        return makeObject(info);
}

function importNS(ns, version) {
    var module = {};

    var repo = _gir.Repository_get_default();
    _gir.Repository_require.call(repo, ns, version || null, 0);

    var nInfos = _gir.Repository_get_n_infos.call(repo, ns);
    for (var i = 0; i < nInfos; i++) {
        var info = _gir.Repository_get_info.call(repo, ns, i);
        var name = _gir.BaseInfo_get_name.call(info);
        module[name] = makeInfo(info);
    }

    return module;
}

exports.importNS = function(name, version) {
    var ns = importNS(name, version);

    var override;
    try {
        override = require('./overrides/' + name);
    } catch (e) {
        // No override
    }

    if (override)
        override.apply(ns);

    return ns;
};

exports.startLoop = function() {
    _gi.StartLoop();
};
