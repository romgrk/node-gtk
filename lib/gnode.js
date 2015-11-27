
const _gi = require('../build/Debug/gi');

exports.importNS = function(name, version) {
    var ns = _gi.importNS(name, version);
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
