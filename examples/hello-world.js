/*
 * A minimal "Hello World" using libadwaita (GTK4-based).
 */

const gi = require('../lib/');
const GLib = gi.require('GLib', '2.0');
const Gtk = gi.require('Gtk', '4.0');
const Adw = gi.require('Adw', '1');

const loop = GLib.MainLoop.new(null, false);
const app = new Adw.Application('com.github.romgrk.node-gtk.hello', 0);

app.on('activate', () => {
  const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
  content.append(new Adw.HeaderBar());
  content.append(new Gtk.Label({ label: 'Hello Adwaita!', vexpand: true }));

  const window = new Adw.ApplicationWindow(app);
  window.setTitle('node-gtk');
  window.setDefaultSize(300, 120);
  window.setContent(content);
  window.on('close-request', () => (loop.quit(), app.quit(), false));
  window.present();

  gi.startLoop();
  loop.run();
});

process.exit(app.run([]));
