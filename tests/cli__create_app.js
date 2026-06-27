/*
 * cli__create_app.js
 *
 * Smoke-tests the `node-gtk create` creator. Pure filesystem work — no native
 * addon, no typelibs, no display — so it runs anywhere.
 */

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const createApp = require('../tools/create-app.js')

// ---- name derivation -------------------------------------------------------

assert.strictEqual(createApp.toAppName('my-cool-app'), 'My Cool App')
assert.strictEqual(createApp.toAppName('my_cool_app'), 'My Cool App')
assert.strictEqual(createApp.toPkgName('My Cool App'), 'my-cool-app')
assert.strictEqual(createApp.toAppId('My Cool App'), 'com.example.MyCoolApp')

assert.ok(createApp.isValidAppId('com.example.MyApp'))
assert.ok(createApp.isValidAppId('org.gnome.Foo-Bar'))
assert.ok(!createApp.isValidAppId('notreverse'))
assert.ok(!createApp.isValidAppId('1com.example.App'))
assert.ok(!createApp.isValidAppId('com.example.'))

// ---- project creation ------------------------------------------------------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ngtk-create-'))
const dir = path.join(tmp, 'demo-app')

const written = createApp.createProject({
  dir,
  appName: 'Demo App',
  appId: 'com.example.DemoApp',
  pkgName: 'demo-app',
  nodeGtkVersion: '^9.9.9',
})

const expected = ['package.json', 'tsconfig.json', '.gitignore', 'README.md', 'style.css', path.join('src', 'main.ts')]
for (const f of expected) {
  assert.ok(written.includes(f), `createProject() should report writing ${f}`)
  assert.ok(fs.existsSync(path.join(dir, f)), `${f} should exist on disk`)
}

// package.json is valid JSON with the expected shape and a real node-gtk dep.
const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
assert.strictEqual(pkg.name, 'demo-app')
assert.strictEqual(pkg.type, 'module')
assert.strictEqual(pkg.dependencies['node-gtk'], '^9.9.9', 'node-gtk version should be substituted')
// nodeGtkDependency() falls back to a file: spec when run from a source checkout.
assert.ok(/^(\^\d|file:)/.test(createApp.nodeGtkDependency()), 'dependency is a version range or file: path')
assert.ok(pkg.scripts.dev && pkg.scripts.build && pkg.scripts['generate-types'], 'expected scripts present')
// `dev` delegates to the CSS-reload mode; `dev:app-reload` adds node --watch.
assert.ok(pkg.scripts.dev.includes('dev:css-reload'), 'dev should run the css-reload script')
assert.ok(pkg.scripts['dev:app-reload'].includes('--watch'), 'dev:app-reload should use node --watch')
// the scripts that actually launch node must install the gi: loader hooks.
for (const s of ['dev:css-reload', 'dev:app-reload', 'start'])
  assert.ok(pkg.scripts[s].includes('node-gtk/register'), `${s} should --import node-gtk/register`)
// Both dev modes enable node-gtk/styles hot-reload via cross-env (cross-platform
// NODE_ENV=development — a bare `NODE_ENV=...` prefix would break on Windows).
for (const s of ['dev:css-reload', 'dev:app-reload'])
  assert.ok(pkg.scripts[s].includes('cross-env NODE_ENV=development'), `${s} should set NODE_ENV via cross-env`)
assert.ok(pkg.devDependencies['cross-env'], 'cross-env should be a devDependency')

// tsconfig.json is valid JSON, points at the generated types, and pulls the
// shim into the program (via `files`, since it lives under node_modules) so the
// `gi:` ambient modules resolve.
const tsconfig = JSON.parse(fs.readFileSync(path.join(dir, 'tsconfig.json'), 'utf8'))
assert.ok(tsconfig.compilerOptions.paths['node-gtk'][0].includes('.node-gtk-types'))
assert.ok(tsconfig.files.some((p) => p.includes('.node-gtk-types')), 'tsconfig should pull in the shim')

// tokens are fully substituted in the source — no leftover placeholders.
const main = fs.readFileSync(path.join(dir, 'src', 'main.ts'), 'utf8')
assert.ok(main.includes("const APP_ID = 'com.example.DemoApp'"), 'app id substituted')
assert.ok(main.includes('Welcome to Demo App'), 'app name substituted')
// uses the `gi:` import scheme, and not the removed startLoop()/gi.require shape.
assert.ok(main.includes("import Gtk from 'gi:Gtk-4.0'"), 'uses gi: imports')
assert.ok(!main.includes('startLoop'), 'must not call the removed gi.startLoop()')
// styles are applied via node-gtk/styles (hot-reloadable), not a hand-rolled
// CssProvider.
assert.ok(main.includes("import { styles } from 'node-gtk/styles'"), 'imports node-gtk/styles')
assert.ok(main.includes('styles.addFile('), 'loads style.css through node-gtk/styles')
assert.ok(!main.includes('new Gtk.CssProvider'), 'no longer hand-rolls a CssProvider')
for (const file of expected) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8')
  assert.ok(!/__[A-Z_]+__/.test(text), `no unsubstituted tokens left in ${file}`)
}

// refuses a non-empty target unless forced.
assert.throws(() => createApp.createProject({ dir, appName: 'X', appId: 'com.example.X', pkgName: 'x' }),
  /not empty/, 'should refuse a non-empty directory')
assert.doesNotThrow(() => createApp.createProject({ dir, appName: 'X', appId: 'com.example.X', pkgName: 'x', force: true }),
  'should overwrite a non-empty directory with force')

fs.rmSync(tmp, { recursive: true, force: true })

console.log('cli__create_app: ok')
