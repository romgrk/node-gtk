const gi = require('.');
const Gtk = gi.require('Gtk', '4.0');
const Gio = gi.require('Gio', '2.0');
const GLib = gi.require('GLib', '2.0');

class TestApplication extends Gtk.Application {
  constructor() {
    super('org.ultrasonicmadness.test', 0);

    const window = new Gtk.ApplicationWindow();
    const button = new Gtk.Button({ label: 'About' });
    window.setChild(button);

    button.connect('clicked', this.showAboutDialog);

    window.setVisible(true);
    window.on('close-request', () => {
      this.loop.quit();
      process.exit(0);
    });

    gi.startLoop();
    this.loop = GLib.MainLoop.new(null, false);
    this.loop.run();
  }

  showAboutDialog() {
    const aboutDialog = new Gtk.AboutDialog({
      'program-name': 'Test',
      authors: ['UltrasonicMadness'],
    });

    aboutDialog.setVisible(true);
  }
}

Gtk.init([]);
let app = new TestApplication();
app.run();
