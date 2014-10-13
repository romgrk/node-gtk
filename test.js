
const gi = require('./build/Debug/gi');
const GLib = gi.importRepo("GLib");
console.log(GLib.ascii_strup("foo", -1));
