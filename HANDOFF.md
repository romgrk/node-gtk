# HANDOFF — `node-gtk bundle` for Windows and macOS

**Mission**: implement the Windows and macOS platform modules for
`node-gtk bundle`, so the portable-bundle story covers all three desktop
platforms. Linux (`bundle` + `flatpak`) shipped in PR #489 (master `e9b9c4e`);
read `doc/bundling.md` first — its Roadmap section is this document's summary.

Everything below was learned or designed while building the Linux path;
Windows/macOS module drafts existed during that work and were validated in
design (not in execution), so treat the specifics as strong hints, not gospel.

## Architecture you are plugging into

`tools/bundle.js` orchestrates; per-OS work lives behind one interface in
`tools/bundle/platform-<os>.js`:

```js
module.exports = {
  NODE_BINARY,            // 'node' | 'node.exe'
  assembleRuntime(ctx),   // libraries + typelibs + schemas/icons/loaders → ctx.runtimeDir
  writeLauncher(ctx),     // returns launcher path
  archive(ctx),           // .tar.gz / .zip / .dmg
}
```

Register the module in the `PLATFORMS` map in `tools/bundle.js`. Everything
else is shared and already works cross-platform:

- `tools/bundle/app-tree.js` — app files + production node_modules
  (pnpm-safe), node-gtk trimmed to `package.json` + `lib/` + the one
  `lib/binding/node-v<abi>-<platform>-<arch>` matching the bundling node.
  `ctx.bindingPath` is the copied `.node` — seed your closure walk from it.
- `tools/bundle/seeds.js` — the GI namespace libraries to bundle, **already
  carrying the win32/darwin file names** (they mirror
  `windows/runtime-libraries.txt`). Every seed is skip-if-missing.
- Config (`loadConfig`), output layout, marker/overwrite safety, node-binary
  copy + strip, size report, `bundle.json` manifest.
- The launcher must include `--import node-gtk/register` when
  `config.register` (default true) — see the Linux/flatpak launchers.

The `ctx` fields you get: `config, appDir, outBase, runtimeDir, appOutDir,
bindingName, bindingPath, log` (+ on darwin you must set/use `ctx.contentsDir`
— `tools/bundle.js` already computes the `.app/Contents` layout for darwin;
check the `process.platform === 'darwin'` branch).

## Windows (`platform-win32.js`) — mostly a port of proven code

`scripts/windows-bundle-runtime.sh` is the **CI-proven reference** (it makes
the npm prebuilt self-contained; test-windows-prebuilt.yaml validated a
no-MSYS2 clean machine). Port its logic to JS; the app bundler is a superset
(adds node.exe + app tree + launcher).

- **Environment**: runs inside an MSYS2 MINGW64 shell (where GTK is installed
  and node-gtk was built) but under the *Windows* node. Resolve the prefix:
  `cygpath -m ${MINGW_PREFIX:-/mingw64}` → `C:/msys64/mingw64`; error with a
  "run from MINGW64" message if absent.
- **DLL closure**: `ntldd -R <file>` per entry (the `.node` + seeds from
  `seedNames('win32', config.libraries, config.gtk)` resolved against
  `<prefix>/bin` + the gdk-pixbuf loader DLLs). Parse `=> C:\...` lines, keep
  only paths under the prefix (System32 stays on the host), copy to
  `runtime/lib` keyed by lowercased basename.
- **Typelibs**: `<prefix>/lib/girepository-1.0/*.typelib` → `runtime/lib/girepository-1.0`.
- **gdk-pixbuf loaders**: `<prefix>/lib/gdk-pixbuf-2.0/2.10.0/loaders/*.dll`;
  rewrite `loaders.cache` loader paths to **bare file names**
  (`.replace(/^"[^"]*[\\/]([^"\\/]+\.dll)"/gm, '"$1"')`) and put the loaders
  dir on PATH in the launcher — this is exactly what `lib/native.js` +
  `windows-bundle-runtime.sh` already do for the prebuilt.
- **Runtime data**: `<prefix>/share/{glib-2.0/schemas/gschemas.compiled,icons/Adwaita,icons/hicolor}`.
- **node**: copy `process.execPath` → `runtime/node.exe` (MSVC node + MinGW
  GTK DLLs interop fine — C ABI; the prebuilt already proves it).
- **Launcher** `<Name>.cmd` (CRLF):
  ```
  @echo off
  setlocal
  set "HERE=%~dp0"
  set "RT=%HERE%runtime"
  set "PATH=%RT%\lib;%RT%\lib\gdk-pixbuf-2.0\2.10.0\loaders;%PATH%"
  set "GI_TYPELIB_PATH=%RT%\lib\girepository-1.0"
  set "XDG_DATA_DIRS=%RT%\share"
  set "GSETTINGS_SCHEMA_DIR=%RT%\share\glib-2.0\schemas"
  set "GDK_PIXBUF_MODULE_FILE=%RT%\lib\gdk-pixbuf-2.0\2.10.0\loaders.cache"
  cd /d "%HERE%app"
  "%RT%\node.exe" --import node-gtk/register ".\<entry>" %*
  ```
  (`cd` into app/ so bare-specifier `--import`s resolve — same reasoning as
  the Linux launcher.)
- **Archive**: `powershell.exe -NoProfile -Command Compress-Archive ...` (zip).
- **CI**: main.yaml's `build-windows` job already builds in MINGW64 with GTK4
  installed. Add a bundle-smoke step for one node version;
  `scripts/bundle-smoke-test.js` already handles win32 (junction symlink,
  `cmd.exe /c` launcher spawn) — just delete its early platform gate as you
  add support. Runners have a desktop session, no xvfb needed.

## macOS (`platform-darwin.js`) — the genuinely new work

GTK comes from Homebrew (CI installs gtk3 via brew today; gtk4 works too).
Two-layer relocation design:

1. **Closure**: walk `otool -L` transitively from the `.node` + seeds
   (`<brew>/lib/<name>`, realpath'd) + pixbuf loaders. Resolve
   `@loader_path/...` against the referencing lib's dir; `@rpath/x` →
   `<brew>/lib/x` heuristic; drop `/usr/lib` + `/System`. Keep only realpaths
   under the brew prefix. Copy flat (basename) into `runtime/lib`.
2. **Rewrite** (`install_name_tool`): for every copied dylib, loader, and the
   `.node`, `-change <brew-path> <relative>/<basename>` where relative is
   `@loader_path` for dylibs (all siblings), `@loader_path/../../..` for
   loaders, and `@loader_path/<computed-rel-to-runtime-lib>` for the `.node`
   (compute with `path.relative`). Do **not** add LC_RPATH entries —
   `-add_rpath` needs header padding and can fail; `-change` to a *shorter*
   string always fits. **Re-sign every touched file ad-hoc**
   (`codesign --force --sign -`) — mandatory on arm64. Where a rewrite fails,
   warn and rely on layer 3.
3. **Launcher env fallback**: `DYLD_FALLBACK_LIBRARY_PATH="$RT/lib:/usr/local/lib:/usr/lib"`.
   Crucial detail: brew **typelibs bake absolute dylib paths**; when GI
   `g_module_open`s a missing absolute path, dyld retries the leaf name
   against the fallback path — that's what makes the bundle work on machines
   without brew. SIP note: DYLD_* vars set *inside* the launcher script
   survive into our (unprotected) node binary; vars inherited *into* a
   protected shell do not — so set them in the script, never rely on the
   caller's env.
- **Layout**: `<outBase>/<Name>.app/Contents/{MacOS/<Name>,Info.plist,Resources/{runtime,app}}`
  (bundle.js already computes these ctx paths). Minimal Info.plist:
  CFBundlePackageType APPL, Name/DisplayName/Identifier/Executable,
  ShortVersionString, NSHighResolutionCapable, LSMinimumSystemVersion 11.0.
- **Runtime data**: `<brew>/share/{glib-2.0/schemas,icons/...}`; if
  `gschemas.compiled` is missing run `glib-compile-schemas`. pixbuf loaders
  under `<brew>/lib/gdk-pixbuf-2.0/2.10.0/loaders` (`.so`/`.dylib`); use the
  same `@LOADERS_DIR@` cache-template + launcher-sed trick as Linux
  (`platform-linux.js`).
- **Archive**: `hdiutil create -volname <Name> -srcfolder <outBase> -ov -format UDZO <out>.dmg`.
- **node strip**: `strip -x` on darwin (see ci.sh), then ad-hoc re-sign.
- **CI**: the macos job has brew GTK3; the smoke fixture already falls back
  Gtk4→Gtk3. Caveat: the runner *has* brew, so the DYLD-fallback path isn't
  truly exercised there — a follow-up "consume on clean machine" job (rename
  the brew prefix, or a second runner without brew) is the honest test,
  mirroring test-windows-prebuilt.yaml's two-job pattern.
- **Distribution reality**: output is unsigned; document that shipping needs
  Developer ID signing + notarization (out of scope for the module itself).
- Per-arch bundles (arm64 + x86_64 separately) — don't attempt universal.

## Shared follow-ups (not yours, but don't preclude them)

AppImage wrapper around the Linux tree; shared-runtime install (`runtime/` is
already content-addressed-friendly); Flathub submission of a first real app.

## Validation bar (what "done" meant for Linux)

1. `scripts/bundle-smoke-test.js` green on the target OS in CI (it asserts
   the app ran under the **bundled** node).
2. A real app bundled and launched by hand at least once
   (`~/src/mariner` is the guinea pig; its node_modules/node-gtk is a symlink
   — point it at your worktree).
3. Size report sane; no host-path leakage (Linux used `LD_DEBUG=libs`; use
   `DYLD_PRINT_LIBRARIES=1` / Process Monitor equivalents).
4. Docs: extend `doc/bundling.md` (platform sections + caveats), drop the
   "Linux today" banners, update the Roadmap.

## Process notes

- Worktrees in `~/worktrees`, `pnpm install` (no node_modules symlinks),
  explicit `git add` (never `-A`), Conventional Commits, PR against master,
  merge only on `gh run view --json conclusion` == success.
- Project memory (`~/.claude/projects/-home-romgrk-src-node-gtk/memory/`)
  has the full Linux war story under `project_bundle_cli.md`.
