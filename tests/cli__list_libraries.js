/*
 * cli__list_libraries.js
 *
 * Tests the `node-gtk list` tool: the pure version comparator, and that
 * collect() groups/sorts/filters the typelibs installed on this machine.
 */

const assert = require('assert')
const list = require('../tools/list-libraries.js')
const { compareVersions, collect } = list

// ---- version comparison (pure, numeric-aware) ------------------------------

assert.ok(compareVersions('3.0', '4.0') < 0)
assert.ok(compareVersions('4.0', '3.0') > 0)
assert.ok(compareVersions('1', '2.0') < 0)
assert.ok(compareVersions('10.0', '9.0') > 0, 'numeric, not lexical (10 > 9)')
assert.strictEqual(compareVersions('2.0', '2.0'), 0)
assert.deepStrictEqual(
  ['4.0', '1', '10.0', '3.0'].sort(compareVersions),
  ['1', '3.0', '4.0', '10.0'],
  'sorts ascending numerically')

// ---- collect() over the locally-installed typelibs -------------------------

;(async () => {
  const libs = await collect()
  assert.ok(Array.isArray(libs), 'collect() returns an array')

  for (const lib of libs) {
    assert.ok(typeof lib.name === 'string' && lib.name.length > 0, 'lib has a name')
    assert.ok(Array.isArray(lib.versions), `${lib.name} has a versions array`)
    assert.deepStrictEqual(lib.versions, lib.versions.slice().sort(compareVersions),
      `${lib.name} versions are sorted`)
    assert.strictEqual(new Set(lib.versions).size, lib.versions.length,
      `${lib.name} versions are deduped`)
  }

  const names = libs.map(l => l.name)
  assert.deepStrictEqual(names, names.slice().sort((a, b) => a.localeCompare(b)),
    'libraries are sorted by name')

  // GLib is always present wherever node-gtk runs, so the unfiltered list is
  // non-empty and a substring filter is a strict subset that only matches.
  assert.ok(libs.length > 0, 'at least one library is available')
  const filtered = await collect('glib')
  assert.ok(filtered.length <= libs.length, 'filter narrows the list')
  assert.ok(filtered.every(l => l.name.toLowerCase().includes('glib')),
    'every filtered result matches the filter')

  console.log('cli__list_libraries: ok')
})().catch(err => { console.error(err); process.exit(1) })
