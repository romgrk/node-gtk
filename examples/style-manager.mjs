/*
 * style-manager.mjs
 *
 * Demonstrates node-gtk/styles: live hot-reload of inline CSS and a `.css` file.
 *
 * Run with (hot-reload only runs when NODE_ENV=development):
 *   NODE_ENV=development node --import node-gtk/register examples/style-manager.mjs
 *
 * Then, while it's running, edit either of these and watch the window update
 * without a restart:
 *   - examples/style-manager.css         (the `.css` file)        → re-read live
 *   - examples/style-manager.styles.mjs  (inline-styles module)   → re-imported
 */
import GLib from 'gi:GLib-2.0'
import Gtk from 'gi:Gtk-4.0'
import { styles } from 'node-gtk/styles'

// Inline CSS lives in its own module so the hot-reloader can safely re-run it.
import './style-manager.styles.mjs'

const loop = GLib.MainLoop.new(null, false)
const app = new Gtk.Application({ applicationId: 'com.github.romgrk.NodeGtkStyles' })

app.on('activate', () => {
  // A `.css` file next to this script; the URL form resolves wherever it's run.
  styles.addFile(new URL('./style-manager.css', import.meta.url))

  const window = new Gtk.ApplicationWindow({ application: app, title: 'node-gtk · styles' })
  window.setDefaultSize(440, 260)

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 16,
    marginTop: 24, marginBottom: 24, marginStart: 24, marginEnd: 24,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
  })
  box.addCssClass('card') // styled by style-manager.css

  const title = new Gtk.Label({ label: 'Edit the CSS — it reloads live' })
  title.addCssClass('headline') // styled by the inline-styles module

  const button = new Gtk.Button({ label: 'A button' })
  button.addCssClass('accent')

  box.append(title)
  box.append(button)
  window.setChild(box)

  styles.install() // flush queued styles and start the file watcher
  window.present()

  window.on('close-request', () => (loop.quit(), app.quit(), false))
  loop.run() // returns immediately under ESM — we quit from the close handler
})

app.run([])
