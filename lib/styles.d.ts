/*
 * Type declarations for node-gtk/styles (see lib/styles.js).
 *
 * The public surface deals only in strings, URLs, and plain handles, so these
 * types are self-contained — they don't reference the GTK typings.
 */

/** Options shared by the inline-CSS sheets. */
export interface StyleOptions {
  /** Provider priority; defaults to `Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION`. */
  priority?: number
}

/** Options for {@link StyleManager.addFile}. */
export interface StyleFileOptions extends StyleOptions {
  /** Watch the file for hot-reload (defaults to on in development). */
  watch?: boolean
}

/** Options for {@link StyleManager.set}. */
export interface StyleSetOptions extends StyleOptions {
  /** Reusing a key replaces the previous keyed sheet in place. */
  key?: string
}

/** A handle to an installed (or queued) stylesheet. */
export interface StyleSheet {
  /** Replace the CSS (or, for a file sheet, re-read the path) in place. */
  update(next: string): void
  /** Remove the sheet from the display. */
  remove(): void
}

/**
 * Applies CSS to a GTK app and, in development, hot-reloads it. The module
 * exports a shared {@link styles} instance; constructing your own is rarely
 * needed.
 */
export declare class StyleManager {
  /**
   * Queue (or, once the display exists, install) inline CSS. The source file it
   * is called from is watched for hot-reload.
   */
  add(css: string, options?: StyleOptions): StyleSheet

  /**
   * Like {@link add}, but never hot-reloaded — for CSS defined inside a module
   * that isn't safe to re-execute (e.g. your entry point).
   */
  addStatic(css: string, options?: StyleOptions): StyleSheet

  /**
   * Queue (or install) a `.css` file. Unless `watch` is false, the file is
   * watched and re-read into its provider on every edit. Idempotent per path.
   * @param path A path, a `file://` URL string, or a `URL`.
   */
  addFile(path: string | URL, options?: StyleFileOptions): StyleSheet

  /**
   * Add — or, when `key` matches an existing sheet, replace in place — a dynamic
   * stylesheet. Requires the display.
   */
  set(css: string, options?: StyleSetOptions): StyleSheet

  /** Remove a keyed stylesheet if present; a no-op otherwise. */
  remove(key: string): void

  /**
   * Install everything queued before the display existed, and start the file
   * watcher. Call once from your `activate` handler. Safe to call repeatedly.
   */
  flush(): void

  /** Alias for {@link flush}, reading better at call sites: `styles.install()`. */
  install(): void

  /** Stop watching and clear pending reloads (teardown / tests). */
  stopHotReload(): void
}

/** The application's shared StyleManager. */
export declare const styles: StyleManager

/** Queue/install inline CSS (shorthand for `styles.add`). */
export declare function addStyles(css: string, options?: StyleOptions): StyleSheet

/** Queue/install a `.css` file (shorthand for `styles.addFile`). */
export declare function addStyleFile(path: string | URL, options?: StyleFileOptions): StyleSheet

/** Flush queued styles and start the watcher (shorthand for `styles.install`). */
export declare function installStyles(): void
