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

  it('add(renderFn) runs the render at install and again on refresh()', () => {
    const styles = new StyleManager()
    let calls = 0
    const sheet = styles.add(() => `.r { color: red; } /* ${++calls} */`)
    expect(calls, 1) // rendered once at install
    sheet.refresh()
    expect(calls, 2) // refresh re-runs the render
  })

  it('update() with a string drops the render fn (literal wins)', () => {
    const styles = new StyleManager()
    let calls = 0
    const sheet = styles.add(() => { calls++; return '.a { color: red; }' })
    expect(calls, 1)
    sheet.update('.b { color: green; }') // now fixed CSS
    sheet.refresh()
    expect(calls, 1) // render no longer invoked
  })

  it('watch:false installs without watching the caller', () => {
    const styles = new StyleManager()
    styles.add('.q { color: red; }', { watch: false })
    expect(styles.watchedFiles.size, 0)
    styles.add('.w { color: red; }') // default: watched
    expect(styles.watchedFiles.size, 1)
  })
})

function isntNull(value) {
  assert(value !== null && value !== undefined, 'expected a value, got ' + value)
  return value
}

// The tests above run synchronously and every assertion has run; exit now rather
// than return to the GLib loop (the managers created GFileMonitors, which a real
// app would drive from its main loop).
process.exit(0)
