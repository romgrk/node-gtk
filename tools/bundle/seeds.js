/*
 * seeds.js — libraries that seed the shared-library closure walk.
 *
 * GObject-Introspection loads each namespace's shared library at run time via
 * g_module_open() when the app calls gi.require('Gtk', ...). Those libraries
 * are NOT linked by node_gtk.node, so scanning the addon's own imports misses
 * them: they must be listed explicitly, then expanded into their transitive
 * closure with the platform's dependency walker (ldd / otool / ntldd).
 *
 * Every seed is optional: entries missing on the build machine are skipped
 * with a note, so this one list serves GTK3-only and GTK4-only machines
 * alike. Apps that use more namespaces (GStreamer, libsoup, WebKit, ...) add
 * their libraries through the `libraries` key of the bundle config, using the
 * platform file name.
 *
 * The Windows names mirror windows/runtime-libraries.txt (the seed list of
 * the self-contained npm prebuilt, expanded by scripts/windows-bundle-runtime.sh).
 */

const SEEDS = [
  // --- GObject-Introspection core ---
  { name: 'girepository',
    linux: 'libgirepository-1.0.so.1', darwin: 'libgirepository-1.0.1.dylib', win32: 'libgirepository-1.0-1.dll' },
  { name: 'gio',
    linux: 'libgio-2.0.so.0', darwin: 'libgio-2.0.0.dylib', win32: 'libgio-2.0-0.dll' },

  // --- GTK (both majors optional; whichever exists gets bundled, unless the
  //     app pins one with the `gtk` config key) ---
  { name: 'gtk4', gtk: 4,
    linux: 'libgtk-4.so.1', darwin: 'libgtk-4.1.dylib', win32: 'libgtk-4-1.dll' },
  { name: 'gtk3', gtk: 3,
    linux: 'libgtk-3.so.0', darwin: 'libgtk-3.0.dylib', win32: 'libgtk-3-0.dll' },
  { name: 'adwaita', gtk: 4,
    linux: 'libadwaita-1.so.0', darwin: 'libadwaita-1.0.dylib', win32: 'libadwaita-1-0.dll' },
  { name: 'gtksourceview', gtk: 4,
    linux: 'libgtksourceview-5.so.0', darwin: 'libgtksourceview-5.0.dylib', win32: 'libgtksourceview-5-0.dll' },

  // --- text / graphics ---
  { name: 'pango',
    linux: 'libpango-1.0.so.0', darwin: 'libpango-1.0.0.dylib', win32: 'libpango-1.0-0.dll' },
  { name: 'pangocairo',
    linux: 'libpangocairo-1.0.so.0', darwin: 'libpangocairo-1.0.0.dylib', win32: 'libpangocairo-1.0-0.dll' },
  { name: 'gdk-pixbuf',
    linux: 'libgdk_pixbuf-2.0.so.0', darwin: 'libgdk_pixbuf-2.0.0.dylib', win32: 'libgdk_pixbuf-2.0-0.dll' },
  { name: 'graphene',
    linux: 'libgraphene-1.0.so.0', darwin: 'libgraphene-1.0.0.dylib', win32: 'libgraphene-1.0-0.dll' },
  { name: 'cairo-gobject',
    linux: 'libcairo-gobject.so.2', darwin: 'libcairo-gobject.2.dylib', win32: 'libcairo-gobject-2.dll' },
  // HarfBuzz GObject bindings — referenced by the HarfBuzz typelib but not
  // linked by the GTK stack, so it must be listed explicitly.
  { name: 'harfbuzz-gobject',
    linux: 'libharfbuzz-gobject.so.0', darwin: 'libharfbuzz-gobject.0.dylib', win32: 'libharfbuzz-gobject-0.dll' },
]

// Platform seed file names, plus whatever the app config adds. `gtkMajor`
// (the `gtk` config key) drops the seeds of the other GTK major version.
function seedNames(platform, extraLibraries = [], gtkMajor = undefined) {
  return SEEDS
    .filter(seed => gtkMajor === undefined || seed.gtk === undefined || seed.gtk === gtkMajor)
    .map(seed => seed[platform])
    .filter(Boolean)
    .concat(extraLibraries)
}

/*
 * Linux libraries that must NOT be bundled. Bundling these breaks the app on
 * hosts whose kernel/driver/font stack differs from the build machine — the
 * host's own copies must be used. This follows the AppImage community
 * excludelist (pkg2appimage), the reference for what is safe to ship.
 * https://github.com/AppImageCommunity/pkg2appimage/blob/master/excludelist
 */
const LINUX_EXCLUDED_EXACT = new Set([
  // glibc — tied to the host kernel and loader
  'libc.so.6', 'libm.so.6', 'libdl.so.2', 'libpthread.so.0', 'librt.so.1',
  'libresolv.so.2', 'libutil.so.1', 'libanl.so.1', 'libmvec.so.1',
  'libthread_db.so.1', 'libBrokenLocale.so.1', 'libcidn.so.1',
  // C++ / gcc runtime — must match the host's libgcc/driver stack
  'libstdc++.so.6', 'libgcc_s.so.1',
  // font stack — must match the host's font configuration
  'libfontconfig.so.1', 'libfreetype.so.6', 'libharfbuzz.so.0', 'libfribidi.so.0',
  // audio — host servers
  'libasound.so.2', 'libjack.so.0', 'libpipewire-0.3.so.0',
  // base system
  'libcom_err.so.2', 'libexpat.so.1', 'libgpg-error.so.0', 'libICE.so.6',
  'libSM.so.6', 'libusb-1.0.so.0', 'libuuid.so.1', 'libz.so.1', 'libgmp.so.10',
])

const LINUX_EXCLUDED_FAMILIES = [
  /^ld-linux/,          // the dynamic loader itself
  /^libnss_/,           // glibc NSS plugins
  /^libGL/, /^libEGL/, /^libGLX/, /^libGLdispatch/, /^libOpenGL/, // OpenGL — host GPU drivers
  /^libdrm/, /^libglapi/, /^libgbm/,                              // mesa/DRM — host GPU drivers
  /^libX/, /^libxcb/,   // X11 client stack — host display server
  /^libwayland-/,       // Wayland client stack — host display server
]

function isExcludedLinux(name) {
  return LINUX_EXCLUDED_EXACT.has(name)
    || LINUX_EXCLUDED_FAMILIES.some(re => re.test(name))
}

module.exports = {
  SEEDS,
  seedNames,
  isExcludedLinux,
}
