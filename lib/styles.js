/*
 * styles.js — a small StyleManager for node-gtk apps, with live hot-reload of
 * both inline CSS and `.css` stylesheets (adapted from zym's style-manager).
 *
 * Today, styling a node-gtk app means hand-rolling a `Gtk.CssProvider`, calling
 * `loadFromPath`/`loadFromString`, and adding it to the display — and there is no
 * way to refresh it without restarting the process. This module wraps that in a
 * single object with two ways to add styles:
 *
 *   - styles.add(css)         inline CSS, hot-reloaded by re-importing the source
 *                             module it was called from (see Hot-reload below).
 *   - styles.addFile(path)    a `.css` file, hot-reloaded by re-reading the file
 *                             into the same provider (instant, no restart).
 *
 * The default display does not exist at module-init time, so `add`/`addFile`
 * called before the app activates are queued and installed by `install()` (call
 * it once from your `activate` handler). Calls made after the display exists
 * install immediately — and the first such call auto-flushes the queue, so an
 * app that does all its styling inside `activate` never needs `install()`.
 *
 * Hot-reload (on only when NODE_ENV=development, unless NODE_GTK_STYLE_HOT_RELOAD=0
 * opts out): every file that contributes styles is watched.
 *   - A `.css` file is re-read into its existing provider — GTK re-resolves the
 *     style cascade live, no flash, no restart.
 *   - A *source* file that called `add()` is re-imported with a cache-busting
 *     query so its `add()` calls reinstall the new CSS; the providers from the
 *     previous run are then dropped (new sheets up before old come down — no
 *     unstyled flash). A module that fails to load mid-edit (e.g. a syntax
 *     error) rolls back to the previously working sheets.
 *
 * Because a source file is re-EXECUTED on reload, put hot-reloadable inline CSS
 * in a module whose top level only registers styles — not next to `app.run()`.
 * See doc/styles.md.
 */

const fs = require('node:fs')
const Path = require('node:path')
const { pathToFileURL, fileURLToPath } = require('node:url')

const internal = require('./native.js')
const Module = require('./module.js')

// node-gtk caches namespaces by name, so these return whatever version the app
// already loaded (e.g. Gtk-4.0). Resolved lazily: the app must have imported
// Gtk/Gdk before any style is actually installed (i.e. by `activate`).
const moduleCache = internal.GetModuleCache()
const gtk = () => Module.require('Gtk')
const gdk = () => Module.require('Gdk')

// Hot-reload runs only in development (NODE_ENV=development); it is off
// everywhere else. Within development, opt out with a falsy
// NODE_GTK_STYLE_HOT_RELOAD (0/false/no/off).
const HOT_RELOAD =
  process.env.NODE_ENV === 'development' &&
  !/^(0|false|no|off)$/i.test(process.env.NODE_GTK_STYLE_HOT_RELOAD ?? '')

// Lets caller detection skip this module's own stack frames.
const OWN_FILE = __filename

const DEBOUNCE_MS = 40 // coalesce the burst an editor's atomic save emits

/** The default style priority (application-level), with a fallback constant. */
function defaultPriority() {
  return gtk().STYLE_PROVIDER_PRIORITY_APPLICATION ?? 600
}

/** The default display, or null before it exists (e.g. before app activation). */
function defaultDisplay() {
  // Don't force-load Gdk just to ask: no display until the app has loaded it.
  if (!moduleCache['Gdk']) return null
  return gdk().Display.getDefault()
}

/** Normalise a path argument: a string, a `file://` URL string, or a URL. */
function toPath(p) {
  if (p instanceof URL) return fileURLToPath(p)
  if (typeof p === 'string' && p.startsWith('file:')) return fileURLToPath(p)
  return Path.resolve(p)
}

/** Load CSS text into a provider, across GTK versions (loadFromString is 4.12+). */
function loadCss(provider, css) {
  if (typeof provider.loadFromString === 'function') provider.loadFromString(css)
  else provider.loadFromData(css) // older GTK 4.x
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
  // "  at fn (file:///p/x.ts:1:2)"  or  "  at file:///p/x.ts:1:2"
  const m = frame.match(/\(([^()]+):\d+:\d+\)\s*$/) || frame.match(/\bat\s+([^()\s]+):\d+:\d+\s*$/)
  if (!m) return null
  let loc = m[1]
  const q = loc.indexOf('?') // strip the `?node-gtk-style=N` cache-buster, if any
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
 * @property {(next: string) => void} update   Replace the CSS (or, for a file
 *   sheet, re-read the path) in place.
 * @property {() => void} remove               Remove the sheet from the display.
 */

class StyleManager {
  constructor() {
    this.ready = false
    // Entries awaiting the display (created before `install()`).
    this.queued = []

    // ---- Hot-reload state (only used when HOT_RELOAD is on) ----
    // Providers installed by each *source* file, so a reload can drop the old.
    this.fileProviders = new Map() // srcFile -> Set<provider>
    // File-sheet entries by `.css` path, so an edit re-reads each provider.
    this.cssEntries = new Map() // cssPath -> Set<entry>
    this.watchedFiles = new Set()
    this.dirWatchers = new Map() // dir -> fs.FSWatcher
    this.reloadSeq = 0
    this.reloadTimers = new Map()
    this.reloading = new Set()
    this.reloadPending = new Set()
  }

  /**
   * Queue (or, once the display exists, install) inline CSS. The source file it
   * is called from is watched for hot-reload.
   * @param {string} css
   * @param {{ priority?: number }} [options]
   * @returns {StyleSheet}
   */
  add(css, options = {}) {
    const file = HOT_RELOAD ? callerFile() : null
    const entry = { kind: 'inline', css, file, priority: options.priority, provider: null, cancelled: false }
    this.place(entry)
    if (file) this.watch(file)
    return this.handle(entry)
  }

  /**
   * Queue (or install) a `.css` file. Unless `watch` is false, the file is
   * watched and re-read into its provider on every edit. Idempotent per path:
   * calling it again for the same file refreshes the existing sheet.
   * @param {string|URL} path  A path, a `file://` URL string, or a URL.
   * @param {{ priority?: number, watch?: boolean }} [options]
   * @returns {StyleSheet}
   */
  addFile(path, options = {}) {
    const file = toPath(path)
    const existing = this.cssEntries.get(file)
    if (existing && existing.size) {
      const entry = existing.values().next().value
      if (entry.provider) entry.provider.loadFromPath(file)
      return this.handle(entry)
    }
    const watch = options.watch ?? HOT_RELOAD
    const entry = { kind: 'file', path: file, priority: options.priority, provider: null, cancelled: false, watch }
    this.place(entry)
    if (watch) this.watch(file)
    return this.handle(entry)
  }

  /**
   * Install everything queued before the display existed, and start the file
   * watcher. Call once from your `activate` handler. Safe to call more than once.
   */
  install() {
    if (this.ready) return
    this.ready = true
    const pending = this.queued
    this.queued = []
    for (const entry of pending) this.installEntry(entry)
    if (HOT_RELOAD) this.startWatcher()
  }

  // -------------------------------------------------------------------------
  // installation
  // -------------------------------------------------------------------------

  // Public `install()` (above) flushes the queue; `place`/`installEntry` here do
  // the per-entry work.
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
      if (entry.watch) this.trackCssEntry(entry)
    } else {
      const provider = this.newProvider()
      loadCss(provider, entry.css)
      this.addProvider(provider, entry.priority)
      entry.provider = provider
      if (entry.file) this.trackFileProvider(entry.file, provider)
    }
  }

  newProvider() {
    const provider = new (gtk().CssProvider)()
    // Surface parse errors with a friendly line instead of (only) a GTK critical.
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
          entry.path = toPath(next)
          if (entry.provider) entry.provider.loadFromPath(entry.path)
        } else {
          entry.css = next
          if (entry.provider) loadCss(entry.provider, next)
        }
      },
      remove: () => {
        entry.cancelled = true
        if (entry.provider) this.removeProvider(entry.provider)
        if (entry.kind === 'file') this.cssEntries.get(entry.path)?.delete(entry)
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

  watch(file) {
    if (this.watchedFiles.has(file)) return
    this.watchedFiles.add(file)
    if (this.ready) this.watchDir(Path.dirname(file)) // else startWatcher picks it up
  }

  startWatcher() {
    for (const file of this.watchedFiles) this.watchDir(Path.dirname(file))
  }

  // Watch the containing directory rather than the file itself: this survives
  // the atomic save (write-temp + rename) most editors do, which replaces the
  // file's inode and would silently break a direct file watch.
  watchDir(dir) {
    if (this.dirWatchers.has(dir)) return
    try {
      const watcher = fs.watch(dir, (_event, filename) => {
        if (!filename) {
          // Some platforms don't report the filename; re-check this dir's files.
          for (const file of this.watchedFiles)
            if (Path.dirname(file) === dir) this.onFileChanged(file)
          return
        }
        const file = Path.resolve(dir, filename)
        if (this.watchedFiles.has(file)) this.onFileChanged(file)
      })
      watcher.on('error', () => {}) // transient FS error — the next edit recovers
      this.dirWatchers.set(dir, watcher)
    } catch {
      // can't watch this dir (e.g. it went away) — silently skip
    }
  }

  onFileChanged(file) {
    clearTimeout(this.reloadTimers.get(file))
    this.reloadTimers.set(file, setTimeout(() => {
      this.reloadTimers.delete(file)
      void this.reloadFile(file)
    }, DEBOUNCE_MS))
  }

  async reloadFile(file) {
    // A `.css` data file: re-read it into every provider that loaded it.
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
    // A source module that contributed inline CSS: re-import and swap providers.
    await this.reloadModule(file)
  }

  /**
   * Re-run `file`'s module (cache-busted so Node re-evaluates it) so its `add()`
   * calls reinstall the new CSS, then drop the providers from the previous run.
   * New sheets go up before old come down (no unstyled flash); a load/eval error
   * (e.g. a syntax error mid-edit) rolls back to the previously working sheets.
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

/** The application's shared StyleManager. */
const styles = new StyleManager()

module.exports = {
  StyleManager,
  styles,
}
