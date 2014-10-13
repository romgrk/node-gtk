
const gi = require('./build/Debug/gi');
const GLib = gi.importRepo("GLib");
console.log(GLib.ascii_strup("foo", -1));

const GUdev = gi.importRepo("GUdev");
var client = new GUdev.Client();
console.log(client.query_by_device_file);
