/*
 * Type declarations for node-gtk/styles (see lib/styles.js).
 *
 * The public surface deals only in strings, URLs, and plain handles, so these
 * types are self-contained — they don't reference the GTK typings.
 */

/** Options shared by the style sheets. */
export interface StyleOptions {
  /** Provider priority; defaults to `Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION`. */
  priority?: number
}

/** Options for {@link StyleManager.add}. */
export interface StyleAddOptions extends StyleOptions {
  /**
   * Watch the calling module for hot-reload (defaults to on in development).
   * Pass `false` for a programmatic sheet whose source can't be re-imported
   * safely (built inside a method, or owned by a stateful module); the handle
   * still supports `update`/`refresh`/`remove`.
   */
  watch?: boolean
}

/** Options for {@link StyleManager.addFile}. */
export interface StyleFileOptions extends StyleOptions {
  /** Watch the file for hot-reload (defaults to on in development). */
  watch?: boolean
}

/** A handle to an installed (or queued) stylesheet. */
export interface StyleSheet {
  /**
   * Replace the CSS (or, for a file sheet, re-read the path) in place. For an
   * inline sheet a string replaces any render function — it becomes fixed CSS.
   */
  update(next: string): void
  /**
   * Re-apply the sheet from its current source: re-run the render function
   * (inline) or re-read the path (file). Call it when the state a render reads
   * changes. A no-op for a queued sheet (not yet installed).
   */
  refresh(): void
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
   * is called from is watched for hot-reload (unless `watch` is false).
   *
   * `css` may be a `() => string` *render* function instead of a string, for a
   * dynamic stylesheet built from live state (theme, fonts, …). The render runs
   * now and again on every hot-reload of its module, and on demand via the
   * handle's {@link StyleSheet.refresh}. Keep such a module side-effect-free at
   * its top level (a re-import re-runs it).
   */
  add(css: string | (() => string), options?: StyleAddOptions): StyleSheet

  /**
   * Queue (or install) a `.css` file. Unless `watch` is false, the file is
   * watched and re-read into its provider on every edit. Idempotent per path.
   * @param path A path, a `file://` URL string, or a `URL`.
   */
  addFile(path: string | URL, options?: StyleFileOptions): StyleSheet

  /**
   * Install everything queued before the display existed, and start the file
   * watcher. Call once from your `activate` handler. Safe to call repeatedly.
   */
  install(): void
}

/** The application's shared StyleManager. */
export declare const styles: StyleManager
