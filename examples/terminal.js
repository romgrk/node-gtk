/*
 * A minimal terminal emulator built with the VTE widget (GTK4-based).
 *
 * It embeds a Vte.Terminal inside an Adwaita window and spawns the user's
 * login shell into it, giving you a real, interactive terminal.
 *
 * Run with:  node examples/terminal.js
 */

const gi = require('../lib/');
const GLib = gi.require('GLib', '2.0');
const Gio = gi.require('Gio', '2.0');
const Gtk = gi.require('Gtk', '4.0');
const Adw = gi.require('Adw', '1');
const Vte = gi.require('Vte', '3.91');
const Pango = gi.require('Pango', '1.0');

// Read the desktop's configured monospace font, falling back to the generic
// "Monospace" family if the GNOME interface schema isn't installed.
function getMonospaceFont() {
  const SCHEMA = 'org.gnome.desktop.interface';
  const source = Gio.SettingsSchemaSource.getDefault();

  let font = Pango.FontDescription.fromString('Monospace 11');
  if (source && source.lookup(SCHEMA, true)) {
    const settings = Gio.Settings.new(SCHEMA);
    const name = settings.getString('monospace-font-name');
    if (name)
      font = Pango.FontDescription.fromString(name);
  }

  // VTE has no separate bold font: it synthesizes bold by raising the base
  // font's weight. A light base (e.g. "... Light", weight 300) can't reach a
  // real Bold face, so bold text renders too thin or with the wrong glyphs.
  // Clamp the base up to Normal so the derived bold lands on a true Bold.
  if (font.getWeight() < Pango.Weight.NORMAL)
    font.setWeight(Pango.Weight.NORMAL);

  return font;
}

const loop = GLib.MainLoop.new(null, false);
const app = new Adw.Application('com.github.romgrk.node-gtk.terminal', 0);

app.on('activate', () => {
  const terminal = new Vte.Terminal();
  terminal.setVexpand(true);
  terminal.setHexpand(true);
  terminal.setFont(getMonospaceFont());

  // Spawn the user's shell ($SHELL, falling back to /bin/sh) in $HOME.
  const shell = GLib.getenv('SHELL') || '/bin/sh';
  const home = GLib.getHomeDir();

  terminal.spawnAsync(
    Vte.PtyFlags.DEFAULT,
    home,                       // working directory
    [shell],                    // argv
    null,                       // inherit the parent environment
    GLib.SpawnFlags.DEFAULT,
    null,                       // no child setup
    -1,                         // no timeout
    null,                       // no cancellable
    (term, pid, error) => {
      if (error)
        console.error('Failed to spawn shell:', error.message);
      else
        console.log(`Spawned ${shell} (pid ${pid})`);
    }
  );

  // Quit when the shell exits (e.g. the user types `exit` or hits Ctrl-D).
  terminal.on('child-exited', (status) => {
    console.log(`Shell exited with status ${status}`);
    loop.quit();
    app.quit();
  });

  const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
  content.append(new Adw.HeaderBar());
  content.append(terminal);

  const window = new Adw.ApplicationWindow(app);
  window.setTitle('node-gtk terminal');
  window.setDefaultSize(720, 480);
  window.setContent(content);
  window.on('close-request', () => (loop.quit(), app.quit(), false));
  window.present();

  // Give the terminal keyboard focus so you can start typing immediately.
  terminal.grabFocus();

  gi.startLoop();
  loop.run();
});

process.exit(app.run([]));
