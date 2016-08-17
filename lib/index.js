
var gi;
try {
    gi = require('../build/Release/node-gtk');
} catch(e) {
    gi = require('../build/Debug/node-gtk');
}

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
    var name = GIRepository.BaseInfo_get_name.call(info);
    var flags = GIRepository.function_info_get_flags(info);
    var func = gi.MakeFunction(info);
    var target = flags & GIRepository.FunctionInfoFlags.IS_METHOD ? obj.prototype : obj;
    Object.defineProperty(target, toCamelCase(name), {
        configurable: true,
        writable: true,
        value: func
    });
}

function makeEnum(info) {
    var obj = {};
    var nValues = GIRepository.enum_info_get_n_values(info);

    for (var i = 0; i < nValues; i++) {
        var valueInfo = GIRepository.enum_info_get_value(info, i);
        var valueName = GIRepository.BaseInfo_get_name.call(valueInfo);
        var valueValue = GIRepository.value_info_get_value(valueInfo);
        obj[valueName.toUpperCase()] = valueValue;
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

    var constructor = gi.MakeClass(info);

    var nMethods = GIRepository.object_info_get_n_methods(info);
    for (var i = 0; i < nMethods; i++) {
        var methodInfo = GIRepository.object_info_get_method(info, i);
        declareFunction(constructor, methodInfo);
    }

    var nProperties = GIRepository.object_info_get_n_properties(info);
    for (var i = 0; i < nProperties; i++) {
        var propertyInfo = GIRepository.object_info_get_property(info, i);

        var propertyName = GIRepository.BaseInfo_get_name.call(propertyInfo);
        var jsPropertyName = toCamelCase(propertyName);

        Object.defineProperty(constructor.prototype, jsPropertyName, {
            configurable: true,
            get: propertyGetter(propertyName),
            set: propertySetter(propertyName),
        });
    }

    return constructor;
}

function makeInfo(info) {
    var type = GIRepository.BaseInfo_get_type.call(info);

    if (type === GIRepository.InfoType.ENUM)
        return makeEnum(info);
    if (type === GIRepository.InfoType.CONSTANT)
        return makeConstant(info);
    if (type === GIRepository.InfoType.FUNCTION)
        return makeFunction(info);
    if (type === GIRepository.InfoType.OBJECT)
        return makeObject(info);
}

function importNS(ns, version) {
    var module = {};

    var repo = GIRepository.Repository_get_default();
    GIRepository.Repository_require.call(repo, ns, version || null, 0);

    var nInfos = GIRepository.Repository_get_n_infos.call(repo, ns);
    for (var i = 0; i < nInfos; i++) {
        var info = GIRepository.Repository_get_info.call(repo, ns, i);
        var name = GIRepository.BaseInfo_get_name.call(info);
        module[toCamelCase(name)] = makeInfo(info);
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

// Used to avoid exporting same module every time it's required
var cache = Object.create(null);
exports.importNS = function(ns, version) {
    var module = cache[ns] || (cache[ns] = {});
    var ver = version || '*';
    return module[ver] || (module[ver] = importNS(ns, version));
};

exports.startLoop = function() {
    gi.StartLoop();
};
