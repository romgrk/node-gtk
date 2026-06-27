/*
 * style_manager.js
 *
 * Covers the synchronous surface of lib/styles.js (the StyleManager) against a
 * real display: immediate install once the display exists, per-path idempotency
 * of addFile, and handle update/remove bookkeeping. The file/module hot-reload
 * paths are exercised manually via examples/style-manager.mjs.
 */

// Exercise the hot-reload bookkeeping (watch tracking, cssEntries) — which only
// runs in development. Must be set before lib/styles.js is required, since it
// reads NODE_ENV once at load time.
process.env.NODE_ENV = 'development'

const fs = require('fs')
const os = require('os')
const path = require('path')

const gi = require('../lib/')
const { describe, it, expect, assert, skip } = require('./__common__.js')

let Gtk
try {
  Gtk = gi.require('Gtk', '4.0')
  Gtk.init() // GTK4 returns void; a headless box is caught by the display check below
} catch (e) {
  console.log('Gtk 4.0 not available, skipping:', e.message)
  skip()
}

const Gdk = gi.require('Gdk')
if (!Gdk.Display.getDefault()) {
  console.log('No default display, skipping')
  skip()
}

// Required after the display check so we never import it on a headless box.
const { StyleManager } = require('../lib/styles.js')

const tmpCss = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ngtk-styles-')), 'sheet.css')
fs.writeFileSync(tmpCss, '.tmp { color: red; }')

describe('StyleManager', () => {
  it('installs inline CSS immediately once the display exists', () => {
    const styles = new StyleManager()
    const sheet = styles.add('.a { color: red; }', { priority: 700 })
    isntNull(sheet)
    // No queue should remain: the display is up, so it installed right away.
    expect(styles.queued.length, 0)
  })

  it('is idempotent per .css path: addFile twice tracks one entry', () => {
    const styles = new StyleManager()
    styles.addFile(tmpCss)
    styles.addFile(tmpCss)
    expect(styles.cssEntries.get(path.resolve(tmpCss)).size, 1)
  })

  it('accepts a file:// URL for addFile', () => {
    const styles = new StyleManager()
    const url = new (require('url').URL)(`file://${path.resolve(tmpCss)}`)
    const sheet = styles.addFile(url)
    isntNull(sheet)
  })

  it('update() and remove() on a handle do not throw', () => {
    const styles = new StyleManager()
    const inline = styles.add('.d { color: red; }')
    inline.update('.d { color: green; }')
    inline.remove()

    const file = styles.addFile(tmpCss)
    file.update(tmpCss)
    file.remove()
  })
})

function isntNull(value) {
  assert(value !== null && value !== undefined, 'expected a value, got ' + value)
  return value
}

// The tests above run synchronously. Hot-reload is on by default, so the managers
// they created started file watchers that keep the event loop alive — exit now
// that every assertion has run.
process.exit(0)
