/*
 * bundle-smoke-test.js
 *
 * End-to-end test of `node-gtk bundle`: creates a minimal app that depends on
 * this checkout of node-gtk, bundles it, then runs the produced launcher and
 * checks that the app's GTK code actually executed inside the bundle.
 *
 * The app tries Gtk 4.0 and falls back to Gtk 3.0, so the test runs
 * regardless of which GTK is installed. It needs a display: run under
 * `xvfb-run -a` in headless environments.
 *
 * Usage: node scripts/bundle-smoke-test.js
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const child_process = require('child_process')

if (process.platform !== 'linux') {
  console.log(`bundle-smoke-test: \`node-gtk bundle\` only supports linux for now, skipping on ${process.platform}`)
  process.exit(0)
}

const repoRoot = path.resolve(__dirname, '..')
const bindingName = `node-v${process.versions.modules}-${process.platform}-${process.arch}`

if (!fs.existsSync(path.join(repoRoot, 'lib', 'binding', bindingName, 'node_gtk.node'))) {
  console.error(`no compiled addon for ${bindingName} — build node-gtk first (pnpm run build:full)`)
  process.exit(1)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'node-gtk-bundle-smoke-'))
const appDir = path.join(tmp, 'app')
fs.mkdirSync(appDir, { recursive: true })

// --- the app ----------------------------------------------------------------

fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({
  name: 'bundle-smoke',
  version: '1.0.0',
  main: 'main.js',
  dependencies: { 'node-gtk': '*' },
  bundle: { name: 'BundleSmoke', id: 'org.nodegtk.BundleSmoke' },
}, null, 2))

fs.writeFileSync(path.join(appDir, 'main.js'), `
const gi = require('node-gtk')
let Gtk, major
try { Gtk = gi.require('Gtk', '4.0'); major = 4 }
catch (e) { Gtk = gi.require('Gtk', '3.0'); major = 3 }
Gtk.init()
const label = new Gtk.Label({ label: 'bundle-smoke' })
if (label.getLabel() !== 'bundle-smoke')
  throw new Error('label mismatch: ' + label.getLabel())
console.log('BUNDLE_SMOKE_OK gtk' + major + ' node=' + process.version + ' exec=' + process.execPath)
process.exit(0)
`)

// The app depends on THIS checkout: link it in place of a registry install.
// The bundler dereferences the link and copies real (trimmed) files.
fs.mkdirSync(path.join(appDir, 'node_modules'))
fs.symlinkSync(repoRoot, path.join(appDir, 'node_modules', 'node-gtk'),
  process.platform === 'win32' ? 'junction' : 'dir')

// --- bundle -------------------------------------------------------------------

console.log(`smoke: bundling in ${appDir}`)
const outDir = path.join(tmp, 'out')
const bundleResult = child_process.spawnSync(
  process.execPath, [path.join(repoRoot, 'bin', 'node-gtk.js'), 'bundle', appDir, '--out', outDir],
  { stdio: 'inherit', env: { ...process.env, NODE_GTK_BUNDLE_DEBUG: '1' } })
if (bundleResult.status !== 0) {
  console.error(`smoke: FAIL — bundler exited with ${bundleResult.status} (kept: ${tmp})`)
  process.exit(1)
}

// --- run the launcher, exactly as a user would ----------------------------------

const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'bundle.json'), 'utf8'))
const launcher = path.join(outDir, manifest.launcher)
console.log(`smoke: running ${launcher}`)

const runResult = process.platform === 'win32'
  ? child_process.spawnSync('cmd.exe', ['/c', launcher], { encoding: 'utf8' })
  : child_process.spawnSync(launcher, [], { encoding: 'utf8' })

process.stdout.write(runResult.stdout || '')
process.stderr.write(runResult.stderr || '')

if (runResult.status !== 0 || !(runResult.stdout || '').includes('BUNDLE_SMOKE_OK')) {
  console.error(`smoke: FAIL — launcher exited with ${runResult.status} (kept: ${tmp})`)
  process.exit(1)
}

// The bundled node must be the one that ran, not the system node.
if (!runResult.stdout.includes(path.join('runtime', 'node'))) {
  console.error(`smoke: FAIL — app ran under the wrong node: ${runResult.stdout.trim()} (kept: ${tmp})`)
  process.exit(1)
}

console.log('smoke: PASS')
fs.rmSync(tmp, { recursive: true, force: true })
