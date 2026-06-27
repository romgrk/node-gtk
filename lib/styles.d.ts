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

/** Options for {@link StyleManager.addFile}. */
export interface StyleFileOptions extends StyleOptions {
  /** Watch the file for hot-reload (defaults to on in development). */
  watch?: boolean
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
