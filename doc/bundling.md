# Bundling — ship your app to users

`node-gtk bundle` creates a **self-contained, double-clickable bundle** of a
node-gtk application: your code, a node runtime, the compiled node-gtk addon,
and the entire GTK runtime it needs. The result runs on machines with no
node, no GTK, and no compiler installed.

> **Platform support: Linux today.** macOS and Windows are planned; the
> platform-specific work is isolated behind one module interface
> (`tools/bundle/platform-*.js`), and the Windows DLL-closure logic is already
> proven by the self-contained npm prebuilt (`scripts/windows-bundle-runtime.sh`).
> For distribution-grade Linux packaging (Flatpak, AppImage), see
> [Roadmap](#roadmap) — the portable tree this command produces is exactly what
> those formats wrap.

## Usage

```sh
cd my-app
npx node-gtk bundle            # → dist/MyApp-linux-x64/
npx node-gtk bundle --archive  # → dist/MyApp-linux-x64.tar.gz too
```

Requirements at bundle time: the app is installed (`node_modules` present,
any package manager — pnpm symlink layouts are handled), node-gtk has a
compiled addon for the running node, and the GTK stack you target is
installed. **The node that runs the bundler is the node that ships.**

Users run the launcher — no installation:

```sh
tar xzf MyApp-linux-x64.tar.gz
./MyApp-linux-x64/MyApp
```

## Output layout

```
MyApp-linux-x64/
├── MyApp           launcher (sh) — wires the runtime env, execs bundled node
├── bundle.json     manifest: name, id, versions, launcher path
├── runtime/        ← identical across apps sharing a node-gtk/GTK version
│   ├── node        node binary (stripped copy of the bundling node)
│   ├── lib/        shared-library closure + girepository-1.0/ typelibs
│   │   └── gdk-pixbuf-2.0/…/loaders + relocatable loaders.cache.in
│   └── share/      compiled GSettings schemas, Adwaita/hicolor icon themes
└── app/            ← yours: files from `include` + production node_modules
```

The `runtime/` vs `app/` split is deliberate: `runtime/` is content-identical
for every app built with the same node-gtk/GTK/node versions, so a future
shared-runtime install (or content-addressed stores like Flatpak's) can
deduplicate it without a layout change. `app/` is typically a few MB.

The launcher sets `LD_LIBRARY_PATH`, `GI_TYPELIB_PATH` and `XDG_DATA_DIRS` to
prefer `runtime/`, generates a per-install gdk-pixbuf loader cache (the cache
format needs absolute paths), `cd`s into `app/` and execs `runtime/node` on
your entry.

## Configuration

Everything lives under the `"bundle"` key of your `package.json`; every field
is optional:

```jsonc
{
  "main": "src/main.js",
  "bundle": {
    "name": "MyApp",                 // launcher/file name; default: PascalCase package name
    "id": "com.example.MyApp",       // reverse-DNS id (cache dirs); default derived
    "entry": "src/main.js",          // default: "main"
    "gtk": 4,                        // bundle only this GTK major (default: all installed)
    "include": ["src/**", "assets/**"],  // app files; default: "**/*" minus
                                     // node_modules/.git/dist/out/build
    "nodeArgs": ["--import", "node-gtk/register"],  // e.g. for TS entries
    "libraries": ["libgstreamer-1.0.so.0"],  // extra closure seeds (GStreamer, libsoup, …)
    "omitPackages": ["some-dev-helper"],     // npm packages to leave out
    "icons": false,                  // skip Adwaita/hicolor themes (default: true)
    "node": "vendor/node",           // ship this node binary instead (same ABI!)
    "out": "release"                 // default: dist/<name>-<platform>-<arch>
  }
}
```

CLI flags `--out`, `--name`, `--entry`, `--archive` override the config.

### What gets bundled, what stays on the host

The shared-library closure is walked with `ldd`, seeded from the addon, the
GI namespace libraries (GTK, Adwaita, Pango, GdkPixbuf, …— see
`tools/bundle/seeds.js`; missing ones are skipped, `libraries` adds more) and
the gdk-pixbuf loaders. Host-tied libraries are **excluded**, following the
[AppImage community excludelist](https://github.com/AppImageCommunity/pkg2appimage/blob/master/excludelist):
glibc, the GPU/OpenGL stack, X11/Wayland client libraries, and the font stack
(fontconfig/freetype/harfbuzz), which every desktop provides.

Node packages: the production dependency closure of your app, symlinks
dereferenced. node-gtk itself is trimmed to `package.json` + `lib/` with only
the target ABI's compiled addon; its build-time deps (node-pre-gyp, node-gyp,
nan) never ship.

### Compatibility baseline

A bundle runs on distros whose **glibc is at least as new** as the build
machine's (the classic portable-Linux constraint — the excluded libraries
resolve against the host). Build on the oldest distribution you want to
support; a GitHub Actions `ubuntu-latest` runner is a reasonable baseline.
`bundle.node` exists so you can ship a node built against an older glibc than
your machine's.

### Size expectations

GTK4 + Adwaita + typelibs + icons ≈ 135 MB, node ≈ 110 MB, ~100 MB as a
`.tar.gz` — Electron-class. `"gtk": 4` avoids also shipping GTK3 from a
machine that has both; `"icons": false` saves ~15 MB if you rely on host
themes.

## Verifying a bundle

CI runs `scripts/bundle-smoke-test.js` (bundle a minimal app, run its
launcher, assert the app executed under the bundled node). To check where
libraries resolve from on your machine:

```sh
LD_DEBUG=libs ./dist/MyApp-linux-x64/MyApp 2>&1 | grep 'trying file.*libgtk'
```

## Roadmap

- **Windows**: same architecture; DLL closure via `ntldd` (already CI-proven
  for the npm prebuilt), `.cmd` launcher, `.zip` archive. Needs an MSYS2
  MINGW64 environment at bundle time.
- **macOS**: dylib closure via `otool -L` from Homebrew,
  `install_name_tool` relocation + ad-hoc re-signing, `.app`/`.dmg` output,
  `DYLD_FALLBACK_LIBRARY_PATH` launcher. Distribution additionally requires
  codesigning + notarization (Apple developer account).
- **Flatpak**: the best Linux end-state — apps on `org.gnome.Platform` share
  one GTK runtime and get Flathub distribution; the per-app payload shrinks
  to `app/` + the addon. A manifest generator can build on the same app-tree
  step this command uses.
- **AppImage**: single-file wrapper around exactly this portable tree.
- **Shared runtime**: install `runtime/` once per machine
  (`~/.local/share/node-gtk/runtime/<version>`), apps resolve it
  relative-first — the layout already supports this.
