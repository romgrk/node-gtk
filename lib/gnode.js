
const _gi = require('../build/Release/gi');

exports.importRepo = function(name, version) {
    var ns = _gi.importRepo(name, version);
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
