/*
 * A minimal "Hello World" using libadwaita (GTK4-based).
 *
 * Run with:  node --import node-gtk/register examples/hello-world.mjs
 */

import GLib from 'gi:GLib-2.0';
import Gtk from 'gi:Gtk-4.0';
import Adw from 'gi:Adw-1';

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

  loop.run();
});

// Under ESM the run call returns immediately; the app keeps running and the
// process exits when the window is closed (loop.quit()/app.quit() above).
app.run([]);
