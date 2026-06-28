/*
 * styles.js — a small StyleManager for node-gtk apps. Applies CSS (inline via
 * styles.add, a `.css` file via styles.addFile) and hot-reloads it in
 * development. Adapted from zym's style-manager; see doc/styles.md.
 */

const Path = require('node:path')
const { pathToFileURL, fileURLToPath } = require('node:url')

const internal = require('./native.js')
const Module = require('./module.js')

// Lazily resolved: the app loads Gtk/Gdk/GLib/Gio, not this module. GLib/Gio
// drive hot-reload (watchDir) and arrive with Gtk.
const moduleCache = internal.GetModuleCache()
const gtk = () => Module.require('Gtk')
const gdk = () => Module.require('Gdk')
const glib = () => Module.require('GLib')
const gio = () => Module.require('Gio')

// Dev-only; opt out with a falsy NODE_GTK_STYLE_HOT_RELOAD (0/false/no/off).
const HOT_RELOAD =
  process.env.NODE_ENV === 'development' &&
  !/^(0|false|no|off)$/i.test(process.env.NODE_GTK_STYLE_HOT_RELOAD ?? '')

const OWN_FILE = __filename // skipped during caller detection

const DEBOUNCE_MS = 40 // coalesce the burst an editor's atomic save emits

function defaultPriority() {
  return gtk().STYLE_PROVIDER_PRIORITY_APPLICATION ?? 600
}

/** The default display, or null before it exists (e.g. before app activation). */
function defaultDisplay() {
  if (!moduleCache['Gdk']) return null // don't force-load Gdk just to ask
  return gdk().Display.getDefault()
}

/** Normalise a path / `file:` URL string / URL to an absolute path. */
function toPath(p) {
  if (p instanceof URL) return fileURLToPath(p)
  if (typeof p === 'string' && p.startsWith('file:')) return fileURLToPath(p)
  return Path.resolve(p)
}

function loadCss(provider, css) {
  // loadFromString is GTK 4.12+; fall back on older 4.x.
  if (typeof provider.loadFromString === 'function') provider.loadFromString(css)
  else provider.loadFromData(css)
}

/** Local path of a GFile from a monitor event, or null. GFile is a GInterface,
 *  so its methods live on the prototype, not the instance. */
function gioPath(file) {
  if (!file) return null
  try { return gio().File.prototype.getPath.call(file) } catch { return null }
}

/** Absolute path of the first source file above this module on the stack. */
function callerFile() {
  const stack = new Error().stack
  if (!stack) return null
  for (const line of stack.split('\n').slice(1)) {
    const file = frameFile(line)
    if (file && file !== OWN_FILE) return file
  }
  return null
}

/** Pull the absolute file path out of one V8 stack frame, or null. */
function frameFile(frame) {
  // Matches "(file:line:col)", bare "at file:line:col", and the "at async
  // file:..." form V8 uses for top-level ESM code.
  const m = frame.match(/\(([^()]+):\d+:\d+\)\s*$/) || frame.match(/\bat\s+(?:async\s+)?([^()\s]+):\d+:\d+\s*$/)
  if (!m) return null
  let loc = m[1]
  const q = loc.indexOf('?') // drop the cache-buster query, if any
  if (q !== -1) loc = loc.slice(0, q)
  if (loc.startsWith('file://')) {
    try { return Path.resolve(fileURLToPath(loc)) } catch { return null }
  }
  if (loc.startsWith('node:') || loc.includes('node_modules')) return null
  return Path.resolve(loc)
}

/**
 * A handle to an installed (or queued) stylesheet.
 * @typedef {object} StyleSheet
 * @property {(next: string) => void} update   Replace with fixed CSS (drops any render fn).
 * @property {() => void} refresh              Re-apply from source (re-run render / re-read file).
 * @property {() => void} remove               Remove the sheet from the display.
 */

class StyleManager {
  constructor() {
    this.ready = false
    this.queued = [] // entries awaiting the display

    // File sheets by path, for per-path dedup and reload. path -> Set<entry>.
    this.cssEntries = new Map()

    // ---- Hot-reload state (only used when HOT_RELOAD is on) ----
    this.fileProviders = new Map() // srcFile -> Set<provider>, so a reload drops the old
    this.watchedFiles = new Set()
    this.dirWatchers = new Map() // dir -> Gio.FileMonitor
    this.reloadSeq = 0
    this.reloadTimers = new Map()
    this.reloading = new Set()
    this.reloadPending = new Set()
  }

  /**
   * Inline CSS, hot-reloaded by re-importing its source module. Queued until the
   * display exists.
   *
   * `css` may be a `() => string` *render* function instead of a string, for
   * dynamic stylesheets built from live state (theme, fonts, …). The render runs
   * now and again on every hot-reload of its module (so editing the
   * CSS-generating code re-applies it), and on demand via the handle's
   * `refresh()` — call it whenever the state it reads changes. Keep such a module
   * side-effect-free at its top level (a re-import re-runs it); a stateful
   * singleton it owns must survive re-import (e.g. guarded on `globalThis`).
   *
   * Pass `watch: false` to install without watching the caller for hot-reload —
   * for programmatic sheets whose source can't be re-imported safely (created
   * inside a method, owned by a stateful module). The handle still supports
   * `update`/`refresh`/`remove`.
   * @param {string | (() => string)} css  Inline CSS, or a render function.
   * @param {{ priority?: number, watch?: boolean }} [options]
   * @returns {StyleSheet}
   */
  add(css, options = {}) {
    const render = typeof css === 'function' ? css : null
    const watch = HOT_RELOAD && (options.watch ?? true)
    const file = watch ? callerFile() : null
    const entry = {
      kind: 'inline',
      render,
      css: render ? null : css,
      file,
      priority: options.priority,
      provider: null,
      cancelled: false,
    }
    this.place(entry)
    if (file) this.watch(file)
    return this.handle(entry)
  }

  /**
   * A `.css` file, hot-reloaded by re-reading it (unless `watch` is false).
   * Idempotent per path.
   * @param {string|URL} path  A path, a `file://` URL string, or a URL.
   * @param {{ priority?: number, watch?: boolean }} [options]
   * @returns {StyleSheet}
   */
  addFile(path, options = {}) {
    const file = toPath(path)
    const existing = this.cssEntries.get(file)
    if (existing && existing.size) {
      // Refresh the existing sheet rather than stacking a second provider.
      const entry = existing.values().next().value
      if (entry.provider) entry.provider.loadFromPath(file)
      return this.handle(entry)
    }
    const watch = options.watch ?? HOT_RELOAD
    const entry = { kind: 'file', path: file, priority: options.priority, provider: null, cancelled: false, watch }
    this.trackCssEntry(entry) // register by path now, so re-adds dedup even in production
    this.place(entry)
    if (watch) this.watch(file)
    return this.handle(entry)
  }

  /**
   * Install everything queued before the display existed, and start watching.
   * Call once from your `activate` handler. Safe to call more than once.
   */
  install() {
    if (this.ready) return
    // Before the display exists, providers would never be shown — fail loudly
    // rather than silently drop them. (place()'s auto-flush only runs once a
    // display exists, so it never trips this.)
    if (!defaultDisplay())
      throw new Error('styles.install() called before the display exists — call it from your app\'s "activate" handler')
    this.ready = true
    const pending = this.queued
    this.queued = []
    for (const entry of pending) this.installEntry(entry)
    if (HOT_RELOAD) this.startWatcher()
  }

  // -------------------------------------------------------------------------
  // installation
  // -------------------------------------------------------------------------

  place(entry) {
    if (!this.ready && defaultDisplay()) this.install() // auto-flush on first post-display call
    if (this.ready) this.installEntry(entry)
    else this.queued.push(entry)
  }

  installEntry(entry) {
    if (entry.cancelled) return
    if (entry.kind === 'file') {
      const provider = this.newProvider()
      provider.loadFromPath(entry.path)
      this.addProvider(provider, entry.priority)
      entry.provider = provider
    } else {
      const provider = this.newProvider()
      loadCss(provider, entry.render ? entry.render() : entry.css)
      this.addProvider(provider, entry.priority)
      entry.provider = provider
      if (entry.file) this.trackFileProvider(entry.file, provider)
    }
  }

  newProvider() {
    const provider = new (gtk().CssProvider)()
    // Surface parse errors with a friendly line instead of a bare GTK critical.
    try {
      provider.on('parsing-error', (section, error) => {
        let message = 'CSS parse error'
        try { if (error && error.message) message += `: ${error.message}` } catch {}
        console.warn(`[node-gtk:styles] ${message}`)
      })
    } catch {}
    return provider
  }

  addProvider(provider, priority) {
    const display = defaultDisplay()
    if (display) gtk().StyleContext.addProviderForDisplay(display, provider, priority ?? defaultPriority())
  }

  removeProvider(provider) {
    const display = defaultDisplay()
    if (display) gtk().StyleContext.removeProviderForDisplay(display, provider)
  }

  // -------------------------------------------------------------------------
  // handles
  // -------------------------------------------------------------------------

  handle(entry) {
    return {
      update: (next) => {
        if (entry.kind === 'file') {
          const nextPath = toPath(next)
          if (nextPath !== entry.path) {
            // Re-key tracking + watching to the new path.
            this.untrackCssEntry(entry)
            entry.path = nextPath
            this.trackCssEntry(entry)
            if (entry.watch) this.watch(nextPath)
          }
          if (entry.provider) entry.provider.loadFromPath(entry.path)
        } else {
          // A literal replaces a render function: from now on this is fixed CSS.
          entry.render = null
          entry.css = next
          if (entry.provider) loadCss(entry.provider, next)
        }
      },
      // Re-apply the sheet from its current source: re-run the render function
      // (inline) or re-read the path (file). For a fixed-string inline sheet this
      // just re-loads the same CSS. Use it when the state a render reads changes.
      refresh: () => {
        if (!entry.provider) return
        if (entry.kind === 'file') entry.provider.loadFromPath(entry.path)
        else loadCss(entry.provider, entry.render ? entry.render() : entry.css)
      },
      remove: () => {
        if (entry.cancelled) return
        entry.cancelled = true
        if (entry.provider) this.removeProvider(entry.provider)
        if (entry.kind === 'file') this.untrackCssEntry(entry)
        else this.untrackFileProvider(entry)
      },
    }
  }

  // -------------------------------------------------------------------------
  // hot-reload (dev only)
  // -------------------------------------------------------------------------

  trackFileProvider(file, provider) {
    let set = this.fileProviders.get(file)
    if (!set) this.fileProviders.set(file, (set = new Set()))
    set.add(provider)
  }

  trackCssEntry(entry) {
    let set = this.cssEntries.get(entry.path)
    if (!set) this.cssEntries.set(entry.path, (set = new Set()))
    set.add(entry)
  }

  // When the last sheet for a path is removed, stop watching it — otherwise a
  // later edit would be misrouted through reloadModule and import() the .css.
  untrackCssEntry(entry) {
    const set = this.cssEntries.get(entry.path)
    if (!set) return
    set.delete(entry)
    if (set.size === 0) {
      this.cssEntries.delete(entry.path)
      this.unwatch(entry.path)
    }
  }

  // Drop the provider so the next module reload doesn't re-remove it. Keep
  // watching: re-running the module re-installs its add() calls.
  untrackFileProvider(entry) {
    if (!entry.file || !entry.provider) return
    this.fileProviders.get(entry.file)?.delete(entry.provider)
  }

  watch(file) {
    if (this.watchedFiles.has(file)) return
    this.watchedFiles.add(file)
    if (this.ready) this.watchDir(Path.dirname(file)) // else startWatcher picks it up
  }

  // Stop watching a file; cancel the directory monitor once its last file goes.
  unwatch(file) {
    if (!this.watchedFiles.delete(file)) return
    const timer = this.reloadTimers.get(file)
    if (timer) { glib().sourceRemove(timer); this.reloadTimers.delete(file) }
    const dir = Path.dirname(file)
    for (const f of this.watchedFiles) if (Path.dirname(f) === dir) return
    const monitor = this.dirWatchers.get(dir)
    if (monitor) { try { monitor.cancel() } catch {} ; this.dirWatchers.delete(dir) }
  }

  startWatcher() {
    for (const file of this.watchedFiles) this.watchDir(Path.dirname(file))
  }

  // Watch with a GLib GFileMonitor, not node's fs.watch: it is driven by the
  // GLib loop the app already runs (an fs.watch, a libuv handle, silently stops
  // firing once that loop is the only one running) and it does not keep Node
  // alive on exit. We watch the directory, not the file, so atomic-save renames
  // survive — WATCH_MOVES surfaces them.
  watchDir(dir) {
    if (this.dirWatchers.has(dir)) return
    let monitor
    try {
      const Gio = gio()
      const gfile = Gio.File.newForPath(dir)
      // GFile is a GInterface: its methods live on the prototype, not the instance.
      monitor = Gio.File.prototype.monitorDirectory.call(gfile, Gio.FileMonitorFlags.WATCH_MOVES, null)
    } catch {
      return // Gio unavailable / monitor failed — hot-reload just won't fire
    }
    monitor.on('changed', (file, otherFile) => {
      // Map the event back to a watched file (a rename's target is in otherFile);
      // if neither matches, re-check the dir's files — the debounce coalesces.
      const a = gioPath(file)
      const b = gioPath(otherFile)
      if (a && this.watchedFiles.has(a)) this.onFileChanged(a)
      else if (b && this.watchedFiles.has(b)) this.onFileChanged(b)
      else for (const f of this.watchedFiles) if (Path.dirname(f) === dir) this.onFileChanged(f)
    })
    this.dirWatchers.set(dir, monitor)
  }

  // GLib timeout, not setTimeout, so the debounce is loop-driven too.
  onFileChanged(file) {
    const pending = this.reloadTimers.get(file)
    if (pending) glib().sourceRemove(pending)
    this.reloadTimers.set(file, glib().timeoutAdd(0, DEBOUNCE_MS, () => {
      this.reloadTimers.delete(file)
      void this.reloadFile(file)
      return false // GLib.SOURCE_REMOVE
    }))
  }

  async reloadFile(file) {
    // Dispatch by which registry the file is in; one in neither (e.g. its sheets
    // were removed) is ignored, so a stray .css edit is never import()ed.
    const cssEntries = this.cssEntries.get(file)
    if (cssEntries && cssEntries.size) {
      for (const entry of cssEntries) {
        if (entry.provider) {
          try { entry.provider.loadFromPath(file) } catch {}
        }
      }
      console.info(`[node-gtk:styles] reloaded ${Path.relative(process.cwd(), file)}`)
      return
    }
    if (this.fileProviders.has(file)) await this.reloadModule(file)
  }

  /**
   * Re-import a source module (cache-busted) so its add() calls reinstall the
   * new CSS, then drop the previous run's providers — new sheets up before old
   * come down. A load error rolls back to the previously working sheets.
   */
  async reloadModule(file) {
    if (this.reloading.has(file)) { this.reloadPending.add(file); return }
    this.reloading.add(file)

    const previous = this.fileProviders.get(file) ?? new Set()
    const fresh = new Set()
    this.fileProviders.set(file, fresh) // the re-run's tracking collects into here
    try {
      await import(`${pathToFileURL(file).href}?node-gtk-style=${++this.reloadSeq}`)
      for (const provider of previous) this.removeProvider(provider)
      console.info(`[node-gtk:styles] reloaded ${Path.relative(process.cwd(), file)}`)
    } catch (error) {
      for (const provider of fresh) this.removeProvider(provider)
      this.fileProviders.set(file, previous) // keep the working sheets installed
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[node-gtk:styles] hot-reload failed for ${Path.relative(process.cwd(), file)}: ${message}`)
    } finally {
      this.reloading.delete(file)
      if (this.reloadPending.delete(file)) void this.reloadModule(file)
    }
  }
}

const styles = new StyleManager()

module.exports = {
  StyleManager,
  styles,
}
