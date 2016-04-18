
var gi;
try {
    gi = require('../build/Release/node-gtk');
} catch(e) {
    gi = require('../build/Debug/node-gtk');
}

var _ = require('lodash');

// The bootstrap from C here contains functions and methods for each object,
// namespaced with underscores. See gi.cc for more information.
var GIRepository = gi.Bootstrap(); // :GIRepositoryNamespace {}

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
    var jsName = gi.toCamelCase(name);
    var func = gi.MakeFunction(info);
    var flags = GIRepository.function_info_get_flags(info);
    var target = flags & GIRepository.FunctionInfoFlags.IS_METHOD ? obj.prototype : obj;
    Object.defineProperty(target, name, {
        configurable: true,
        writable: true,
        value: func
    });
    Object.defineProperty(target, jsName, {
        configurable: true,
        writable: true,
        value: func
    });
}

function makeEnum(info) {
    var obj = {};
    var nValues = GIRepository.enum_info_get_n_values(info);
    obj.__info = info;

    for (var i = 0; i < nValues; i++) {
        var valueInfo  = GIRepository.enum_info_get_value(info, i);
        var valueName  = GIRepository.BaseInfo_get_name.call(valueInfo);
        var valueValue = GIRepository.value_info_get_value(valueInfo);
        //obj[valueName.toUpperCase()] = valueValue;
        Object.defineProperty(obj, valueName.toUpperCase(), {
            writable: false,
            //writable:   true,
            enumerable: true,
            value: valueValue,
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

function makeStruct(info) {
    return gi.MakeBoxed(info);
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
        var methodName = GIRepository.BaseInfo_get_name.call(methodInfo);
        console.assert((methodName in constructor)
                || (methodName in constructor.prototype));
        //declareFunction(constructor, methodInfo);
    }

    var nProperties = GIRepository.object_info_get_n_properties(info);
    for (var i = 0; i < nProperties; i++) {
        var propertyInfo = GIRepository.object_info_get_property(info, i);

        var propertyName = GIRepository.BaseInfo_get_name.call(propertyInfo);
        var jsPropertyName = propertyName.replace(/-/g, '_');
        var camelName = _.camelCase(propertyName);

        Object.defineProperty(constructor.prototype, jsPropertyName, {
            configurable: true,
            get: propertyGetter(propertyName),
            set: propertySetter(propertyName),
        });
        Object.defineProperty(constructor.prototype, camelName, {
            configurable: true,
            enumerable: true,
            get: propertyGetter(propertyName),
            set: propertySetter(propertyName),
        });
    }

    return constructor;
}

function makeInfo(info) {
    var type = GIRepository.BaseInfo_get_type.call(info);
    var name = GIRepository.BaseInfo_get_name.call(info);
    var ns   = GIRepository.BaseInfo_get_namespace.call(info);
    //console.log('unhandled:', GIRepository.info_type_to_string(type), name, info);
    global.infos = global.infos || {};
    global.infos[ns] = global.infos[ns] || {};
    global.infos[ns][name] = info;

    switch (type) {
        case GIRepository.InfoType.ENUM:
        case GIRepository.InfoType.FLAGS:
            return makeEnum(info);
        case GIRepository.InfoType.CONSTANT:
            return makeConstant(info);
        case GIRepository.InfoType.FUNCTION:
            return makeFunction(info);
        case GIRepository.InfoType.OBJECT:
            return makeObject(info);
        case GIRepository.InfoType.STRUCT:
            return makeStruct(info);
    }
    //return {__info: info};
}

function inspectNS(ns, version) {
    var module = {};

    var repo = GIRepository.Repository_get_default();
    var typelib = GIRepository.Repository_require.call(repo, ns, version || null, 0);
    var nInfos = GIRepository.Repository_get_n_infos.call(repo, ns);

    module.typelib = typelib;
    module.nInfos = nInfos;
    module.infos = {};

    for (var i = 0; i < nInfos; i++) {
        var info = GIRepository.Repository_get_info.call(repo, ns, i);
        var name = GIRepository.BaseInfo_get_name.call(info);
        var type = GIRepository.BaseInfo_get_type.call(info);
        module.infos[name] = info;
        module.infos[name].type = type;
    }

    return module;
}

function importNS(ns, version) {
    var module = {};

    var repo = GIRepository.Repository_get_default();
    GIRepository.Repository_require.call(repo, ns, version || null, 0);

    var nInfos = GIRepository.Repository_get_n_infos.call(repo, ns);
    for (var i = 0; i < nInfos; i++) {
        var info = GIRepository.Repository_get_info.call(repo, ns, i);
        var name = GIRepository.BaseInfo_get_name.call(info);
        module[name] = makeInfo(info);
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

global.gir = gi;
exports.gi = gi;
exports.GIRepository = GIRepository;
exports.inspectNS = inspectNS;

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
