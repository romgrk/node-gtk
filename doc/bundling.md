# Bundling — ship your app to users

Two commands cover shipping, for different audiences:

- **[`node-gtk flatpak`](#flatpak)** — the way **real users install apps**:
  a Flatpak, one-click installable via GNOME Software, distributable on
  Flathub (updates, sandboxing, shared GTK runtime). Start here for desktop
  distribution.
- **[`node-gtk bundle`](#portable-bundles)** — a **self-contained portable
  directory** (plus `.tar.gz`): your code, a node runtime, the compiled
  addon, and the entire GTK runtime. Runs on machines with nothing
  installed; right for GitHub release artifacts, kiosks, fleets, and
  "try my app" links.

Both read the same `"bundle"` configuration from your package.json.

> **Platform support: Linux today.** macOS and Windows are planned; the
> platform-specific work is isolated behind one module interface
> (`tools/bundle/platform-*.js`), and the Windows DLL-closure logic is already
> proven by the self-contained npm prebuilt (`scripts/windows-bundle-runtime.sh`).

# Portable bundles

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
    "nodeArgs": ["--max-old-space-size=512"], // extra node flags, if any
    "register": true,                // default: launchers pass --import node-gtk/register
                                     // so `gi:` imports work; set false to opt out
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

# Flatpak

```sh
cd my-app
npx node-gtk flatpak             # generate + build + MyApp.flatpak
npx node-gtk flatpak --install   # …and install it (user), then:
flatpak run com.example.MyApp
```

The output `dist/flatpak/MyApp.flatpak` is a **single file users double-click
to install** through GNOME Software on any distro — the file embeds the
Flathub repo reference, so the GNOME runtime is fetched automatically. For
real distribution, [submit the generated manifest to Flathub](#shipping-on-flathub).

Requirements: `flatpak` plus a builder (`flatpak install flathub
org.flatpak.Builder`, or your distro's `flatpak-builder` package). The first
build downloads the GNOME SDK (~1 GB, cached). `--no-build` generates
everything without building.

## How it works

Unlike `node-gtk bundle`, **nothing GTK-related is bundled**: the app runs on
`org.gnome.Platform`, shared across all Flatpak apps and updated
independently. What's inside `/app` is only your code, node (from the
`org.freedesktop.Sdk.Extension.node<N>` SDK extension) and the node-gtk
addon.

`flatpak-builder` builds offline, which is normally painful for Node apps
(lockfile→sources generators). We sidestep it: the same app-tree step
`node-gtk bundle` uses stages your files + production node_modules
(pnpm-safe, symlinks dereferenced) as a plain `dir` source. The only thing
compiled in the sandbox is the node-gtk addon, against the runtime's GTK,
using the SDK extension's bundled node headers (`--nodedir`) — still no
network.

## Flatpak configuration

The shared `"bundle"` key, plus a `"flatpak"` sub-key:

```jsonc
"bundle": {
  "name": "MyApp",
  "id": "com.example.MyApp",       // MUST be your GApplication application-id
  "summary": "Does the thing",     // .desktop comment + AppStream summary
  "icon": "assets/icon.svg",       // svg or png; required by Flathub
  "license": "MIT",                // SPDX, defaults to package.json "license"
  "categories": ["GTK", "Utility"],
  "flatpak": {
    "runtimeVersion": "49",        // org.gnome.Platform version (50 is also current;
                                   // pick one and test against it)
    "node": 26,                    // SDK extension major (20/22/24/26)
    "finishArgs": [                // sandbox permissions beyond the GUI defaults
      "--share=network",
      "--filesystem=home"
    ]
  }
}
```

Flags: `--install` (install user-level), `--run` (install + run), `--no-build`
(generate only), `--release` / `--release-url` (Flathub submission sources,
below), `--lint` (run `flatpak-builder-lint` on the manifest + metainfo — do
this before submitting anywhere).

Defaults grant only GUI access (`wayland`, `fallback-x11`, `ipc`, `dri`) —
network and filesystem are deliberately opt-in; request the minimum, Flathub
reviews it.

Three things that bite:

- **The flatpak id must equal your `Gtk.Application` `applicationId`** —
  otherwise GNOME Shell can't associate windows with the app (generic icon,
  wrong dock entry).
- The sandbox has no host filesystem by default: `fs` reads outside the
  sandbox need `--filesystem=` permissions, or better, the XDG portals.
- **The API surface follows the runtime's libraries, not your dev
  machine's.** A rolling-release host can expose introspected names a
  slightly older GNOME runtime doesn't (e.g. glib ≥2.88 introspects
  `g_unix_signal_add_full` as `GLibUnix.signalAdd`; the GNOME 49 runtime's
  glib 2.86 calls it `signalAddFull`). Write version-tolerant lookups
  (`GLibUnix.signalAdd ?? GLibUnix.signalAddFull`) and test inside the
  sandbox — a node REPL against the runtime is one command:
  `flatpak run --command=/app/bin/node <your.app.Id>`.

## Shipping on Flathub

Flathub builds on its own infrastructure from *fetchable* sources — the
locally staged tree can't be submitted directly. `--release` produces exactly
what a submission needs:

```sh
npx node-gtk flatpak --release --lint
```

- `<Name>-<version>-flatpak-src.tar.gz` — the staged sources (app +
  production node_modules + desktop files) as one tarball
- `<id>.flathub.yml` — the manifest referencing that tarball by URL + sha256
  (URL derived from package.json `"repository"`:
  `https://github.com/<you>/<app>/releases/download/v<version>/<tarball>`;
  override with `--release-url`)

The flow: **1.** fix everything `--lint` reports (the metainfo TODOs —
description, screenshots, releases, content rating — and a real icon);
**2.** create the GitHub release `v<version>` and upload the tarball;
**3.** submit `<id>.flathub.yml` via PR to
[flathub/flathub](https://github.com/flathub/flathub). After acceptance,
users find the app in GNOME Software and every update ships automatically —
new releases are a version bump + new tarball + manifest update in your
Flathub repo.

Alternative without Flathub: host your own flatpak repository (an ostree
repo is static files — GitHub Pages works) and point users at a `.flatpakref`;
you keep update delivery, minus the store discoverability.

# Roadmap

- **Windows**: same `bundle` architecture; DLL closure via `ntldd` (already
  CI-proven for the npm prebuilt), `.cmd` launcher, `.zip` archive. Needs an
  MSYS2 MINGW64 environment at bundle time.
- **macOS**: dylib closure via `otool -L` from Homebrew,
  `install_name_tool` relocation + ad-hoc re-signing, `.app`/`.dmg` output,
  `DYLD_FALLBACK_LIBRARY_PATH` launcher. Distribution additionally requires
  codesigning + notarization (Apple developer account).
- **AppImage**: single-file wrapper around exactly the portable tree.
- **Shared runtime** (portable bundles): install `runtime/` once per machine
  (`~/.local/share/node-gtk/runtime/<version>`), apps resolve it
  relative-first — the layout already supports this.
