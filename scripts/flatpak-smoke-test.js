/*
 * flatpak-smoke-test.js
 *
 * Checks `node-gtk flatpak`. Two modes:
 *
 * Default (generation only — what main.yaml runs on every CI push): stages a
 * minimal app and asserts the generated flatpak sources are complete and
 * buildable — manifest, launcher, desktop file, metainfo, release artifacts
 * (--release), and an app tree carrying the node-gtk COMPILE inputs (src/ +
 * binding.gyp + nan) instead of a host-compiled binding. Needs no GTK, no
 * display and no flatpak.
 *
 * --full (the flatpak-build.yaml workflow_dispatch job, and local release
 * checks): additionally builds the flatpak for real (downloads the GNOME SDK
 * on first run), installs it user-level, and runs the installed app under
 * a private D-Bus session + Xvfb, asserting the GTK code executed inside the
 * sandbox.
 *
 * Usage: node scripts/flatpak-smoke-test.js [--full]
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const child_process = require('child_process')

if (process.platform !== 'linux') {
  console.log(`flatpak-smoke-test: flatpaks are Linux-only, skipping on ${process.platform}`)
  process.exit(0)
}

const full = process.argv.includes('--full')
const repoRoot = path.resolve(__dirname, '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'node-gtk-flatpak-smoke-'))
const appDir = path.join(tmp, 'app')
const id = 'org.nodegtk.FlatpakSmoke'
fs.mkdirSync(appDir, { recursive: true })

fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({
  name: 'flatpak-smoke',
  version: '1.0.0',
  main: 'main.js',
  license: 'MIT',
  repository: 'https://github.com/romgrk/node-gtk.git',
  dependencies: { 'node-gtk': '*' },
  bundle: { name: 'FlatpakSmoke', id, summary: 'Flatpak generation smoke test' },
}, null, 2))
// A real GTK4 app: org.gnome.Platform guarantees Gtk 4.0 in --full mode; the
// generation-only mode never executes it.
fs.writeFileSync(path.join(appDir, 'main.js'), `
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
Gtk.init()
const label = new Gtk.Label({ label: 'flatpak-smoke' })
console.log('FLATPAK_SMOKE_OK', label.getLabel(), 'exec=' + process.execPath)
process.exit(0)
`)
fs.mkdirSync(path.join(appDir, 'node_modules'))
fs.symlinkSync(repoRoot, path.join(appDir, 'node_modules', 'node-gtk'), 'dir')

// App-provided desktop-integration files at the conventional data/ locations:
// the metainfo and icon theme must be discovered and used instead of stubs
// (the missing .desktop still exercises the generated-stub path).
fs.mkdirSync(path.join(appDir, 'data', 'icons', 'hicolor', 'scalable', 'apps'), { recursive: true })
fs.writeFileSync(path.join(appDir, 'data', `${id}.metainfo.xml`), `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${id}</id>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>
  <name>FlatpakSmoke</name>
  <summary>Flatpak generation smoke test</summary>
  <description><p>SMOKE_MARKER_APP_PROVIDED_METAINFO</p></description>
  <launchable type="desktop-id">${id}.desktop</launchable>
</component>
`)
fs.writeFileSync(path.join(appDir, 'data', 'icons', 'hicolor', 'scalable', 'apps', `${id}.svg`),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16"/></svg>\n')

const outDir = path.join(tmp, 'out')
const args = [path.join(repoRoot, 'bin', 'node-gtk.js'), 'flatpak', appDir, '--out', outDir, '--release']
if (!full)
  args.push('--no-build')
else
  args.push('--install')

const result = child_process.spawnSync(process.execPath, args,
  { stdio: 'inherit', env: { ...process.env, NODE_GTK_BUNDLE_DEBUG: '1' } })
if (result.status !== 0) {
  console.error(`smoke: FAIL — node-gtk flatpak exited with ${result.status} (kept: ${tmp})`)
  process.exit(1)
}

// --- generated sources ------------------------------------------------------

const checks = [
  // generated integration files
  [`${id}.yml`, content => content.includes(`app-id: ${id}`) && content.includes('org.freedesktop.Sdk.Extension.node')],
  // the gi: import scheme must work out of the box → loader registered
  ['launcher.sh', content => content.includes('exec /app/bin/node --import node-gtk/register')],
  [`${id}.desktop`, content => content.includes('Exec=' + id)],
  // app-provided data/ files must be used instead of generated stubs
  [`${id}.metainfo.xml`, content => content.includes('SMOKE_MARKER_APP_PROVIDED_METAINFO')],
  [`icons/hicolor/scalable/apps/${id}.svg`, undefined],
  // --release: Flathub manifest (named <id>.yml for the linter) referencing
  // the tarball by url + sha256
  [`flathub/${id}.yml`, content => /type: archive/.test(content) && /sha256: [0-9a-f]{64}/.test(content)],
  ['FlatpakSmoke-1.0.0-flatpak-src.tar.gz', undefined],
  // the staged tree must be COMPILABLE in the sandbox
  ['app/node_modules/node-gtk/binding.gyp', undefined],
  ['app/node_modules/node-gtk/src', undefined],
  ['app/node_modules/nan', undefined],
]
for (const [rel, check] of checks) {
  const p = path.join(outDir, rel)
  if (!fs.existsSync(p)) {
    console.error(`smoke: FAIL — missing ${rel} (kept: ${tmp})`)
    process.exit(1)
  }
  if (check !== undefined && !check(fs.readFileSync(p, 'utf8'))) {
    console.error(`smoke: FAIL — unexpected content in ${rel} (kept: ${tmp})`)
    process.exit(1)
  }
}

// No host-compiled binding may leak into the offline sources.
if (fs.existsSync(path.join(outDir, 'app/node_modules/node-gtk/lib/binding'))) {
  console.error(`smoke: FAIL — host lib/binding leaked into flatpak sources (kept: ${tmp})`)
  process.exit(1)
}

// --- full mode: run the installed flatpak ------------------------------------

if (full) {
  console.log(`smoke: running installed ${id} under dbus-run-session + xvfb`)
  const runResult = child_process.spawnSync(
    'dbus-run-session', ['--', 'xvfb-run', '-a', 'flatpak', 'run', id], { encoding: 'utf8' })
  process.stdout.write(runResult.stdout || '')
  process.stderr.write(runResult.stderr || '')
  if (runResult.status !== 0 || !(runResult.stdout || '').includes('FLATPAK_SMOKE_OK')) {
    console.error(`smoke: FAIL — flatpak run exited with ${runResult.status} (kept: ${tmp})`)
    process.exit(1)
  }
  if (!runResult.stdout.includes('exec=/app/bin/node')) {
    console.error(`smoke: FAIL — app ran under the wrong node (kept: ${tmp})`)
    process.exit(1)
  }
  child_process.spawnSync('flatpak', ['uninstall', '--user', '-y', id])
}

console.log('smoke: PASS')
fs.rmSync(tmp, { recursive: true, force: true })
