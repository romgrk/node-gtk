var
  npg = require('node-pre-gyp'),
  path = require('path'),
  gi = require(npg.find(
    path.resolve(path.join(__dirname, 'package.json')))
  )
;

exports.importNS = function(name, version) {
  return gi.importNS(name, version);
};

exports.startLoop = function() {
  gi.startLoop();
};
