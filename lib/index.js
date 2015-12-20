
var _gi;
try {
    _gi = require('../build/Release/node-gtk');
} catch(e) {
    _gi = require('../build/Debug/node-gtk');
}

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

exports.startLoop = function() {
    _gi.startLoop();
};
