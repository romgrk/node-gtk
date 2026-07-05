/*
 * flatpak-smoke-test.js
 *
 * Checks `node-gtk flatpak --no-build`: stages a minimal app and asserts the
 * generated flatpak sources are complete and buildable — manifest, launcher,
 * desktop file, metainfo, and an app tree carrying the node-gtk COMPILE
 * inputs (src/ + binding.gyp + nan) instead of a host-compiled binding.
 *
 * The actual sandbox build is exercised locally / at release time, not on
 * every CI run: it downloads the ~1 GB GNOME SDK. This test needs no GTK, no
 * display and no flatpak.
 *
 * Usage: node scripts/flatpak-smoke-test.js
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const child_process = require('child_process')

if (process.platform !== 'linux') {
  console.log(`flatpak-smoke-test: flatpaks are Linux-only, skipping on ${process.platform}`)
  process.exit(0)
}

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
  dependencies: { 'node-gtk': '*' },
  bundle: { name: 'FlatpakSmoke', id, summary: 'Flatpak generation smoke test' },
}, null, 2))
fs.writeFileSync(path.join(appDir, 'main.js'), `require('node-gtk')\n`)
fs.mkdirSync(path.join(appDir, 'node_modules'))
fs.symlinkSync(repoRoot, path.join(appDir, 'node_modules', 'node-gtk'), 'dir')

const outDir = path.join(tmp, 'out')
const result = child_process.spawnSync(
  process.execPath,
  [path.join(repoRoot, 'bin', 'node-gtk.js'), 'flatpak', appDir, '--out', outDir, '--no-build'],
  { stdio: 'inherit', env: { ...process.env, NODE_GTK_BUNDLE_DEBUG: '1' } })
if (result.status !== 0) {
  console.error(`smoke: FAIL — generation exited with ${result.status} (kept: ${tmp})`)
  process.exit(1)
}

const checks = [
  // generated integration files
  [`${id}.yml`, content => content.includes(`app-id: ${id}`) && content.includes('org.freedesktop.Sdk.Extension.node')],
  // the gi: import scheme must work out of the box → loader registered
  ['launcher.sh', content => content.includes('exec /app/bin/node --import node-gtk/register')],
  [`${id}.desktop`, content => content.includes('Exec=' + id)],
  [`${id}.metainfo.xml`, content => content.includes(`<id>${id}</id>`)],
  // the staged tree must be COMPILABLE in the sandbox
  ['app/node_modules/node-gtk/binding.gyp', () => true],
  ['app/node_modules/node-gtk/src', () => true],
  ['app/node_modules/nan', () => true],
]
for (const [rel, check] of checks) {
  const p = path.join(outDir, rel)
  if (!fs.existsSync(p)) {
    console.error(`smoke: FAIL — missing ${rel} (kept: ${tmp})`)
    process.exit(1)
  }
  if (fs.statSync(p).isFile() && !check(fs.readFileSync(p, 'utf8'))) {
    console.error(`smoke: FAIL — unexpected content in ${rel} (kept: ${tmp})`)
    process.exit(1)
  }
}

// No host-compiled binding may leak into the offline sources.
if (fs.existsSync(path.join(outDir, 'app/node_modules/node-gtk/lib/binding'))) {
  console.error(`smoke: FAIL — host lib/binding leaked into flatpak sources (kept: ${tmp})`)
  process.exit(1)
}

console.log('smoke: PASS')
fs.rmSync(tmp, { recursive: true, force: true })
