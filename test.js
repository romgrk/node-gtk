
const GNode = require('gnode');
GNode.startLoop();

const GLib = GNode.importNS("GLib");
console.log(GLib.ascii_strup("foo", -1));

const GUdev = GNode.importNS("GUdev");
var client = new GUdev.Client();
var obj = client.query_by_device_file("/dev/dri/card0");
console.log(obj.get_name());

console.log(GLib.test_override());

const Gtk = GNode.importNS("Gtk");
Gtk.init(0, null);

var w = new Gtk.Window();
var b = new Gtk.Button({ label: "Hi!" });
b.connect('clicked', function() { console.log("BB"); });
w.add(b);
w.show_all();

Gtk.main();
