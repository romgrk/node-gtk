
const gi = require('./build/Debug/gi');
const GLib = gi.importRepo("GLib");
console.log(GLib.ascii_strup("foo", -1));

const GUdev = gi.importRepo("GUdev");
var client = new GUdev.Client();
var obj = client.query_by_device_file("/dev/dri/card0");
console.log(obj.get_name());
