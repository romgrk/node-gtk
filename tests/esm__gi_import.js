/*
 * esm__gi_import.js
 *
 * Spawns esm__gi_import.mjs with the gi: ESM hooks installed (via `node --import
 * node-gtk/register`) and asserts that `import Gtk from 'gi:Gtk-4.0'` resolves to
 * the namespace object. The .mjs is not collected by the runner (it only picks up
 * .js files); this .js runner drives it as a child process.
 */

const path = require('path')
const { pathToFileURL } = require('url')
const child_process = require('child_process')
const { assert } = require('./__common__')

const register = pathToFileURL(path.join(__dirname, '..', 'lib', 'esm', 'register.mjs')).href
const fixture = path.join(__dirname, 'esm__gi_import.mjs')

const result = child_process.spawnSync(
  process.execPath,
  ['--import', register, fixture],
  { encoding: 'utf8' }
)

process.stdout.write(result.stdout)
process.stderr.write(result.stderr)

if (result.status === 222)
  process.exit(222) // skip: GI namespace unavailable

assert(
  result.status === 0,
  `gi: ESM import should resolve to the namespace (child exited ${result.status})`
)
