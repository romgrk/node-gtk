/*
 * build-test-fixtures.js
 *
 * Makes the gobject-introspection test libraries (Utility, GIMarshallingTests,
 * Regress) available for node-gtk's test suite. These libraries systematically
 * exercise marshalling of every GObject type in every direction
 * (in/out/inout/return), so they let us test node-gtk's type conversions
 * exhaustively instead of ad-hoc.
 *
 * Strategy: always build from a single pinned upstream source revision, on
 * every platform. Distro-shipped copies (the gobject-introspection package's
 * bundled tests, or prebuilt gjs `installed-tests` typelibs) vary wildly by
 * version — functions and types present on one machine are absent on another —
 * which makes the test suite non-portable. Pinning one revision of the
 * canonical `gobject-introspection-tests` repo and compiling it ourselves gives
 * every machine (dev, Linux CI, macOS CI) the exact same API surface.
 *
 * The pinned sources are downloaded once (as a tarball) and cached under
 * tests/gi-fixtures/.src/; the compiled output goes to tests/gi-fixtures/
 * ({NAME}-1.0.typelib + lib{name}.so). Both are git-ignored.
 *
 * Run directly (`node scripts/build-test-fixtures.js`) or via `npm test`
 * (it runs as a pretest step). Idempotent: existing fixtures are reused unless
 * --force is passed. To bump the upstream revision, change SOURCE_REF.
 */

const fs = require('fs')
const path = require('path')
const { execFileSync, execSync } = require('child_process')

const FIXTURES_DIR = path.join(__dirname, '..', 'tests', 'gi-fixtures')
const SRC_CACHE_DIR = path.join(FIXTURES_DIR, '.src')
const FORCE = process.argv.includes('--force')
const VERBOSE = process.argv.includes('--verbose') || process.env.VERBOSE

// Canonical upstream test sources, pinned to a specific revision so every
// machine builds the identical API. Bump SOURCE_REF to update.
const SOURCE_REPO = 'https://gitlab.gnome.org/GNOME/gobject-introspection-tests'
const SOURCE_REF = '5987255086f59ca271a3a0aa53fbbb15b189be65'

// Each fixture mirrors the upstream meson.build recipe: the GI namespace, its
// shared-library basename, the source/header files that make it up, the
// pkg-config packages it links, and the GI namespaces its typelib includes.
// Order matters: Regress's typelib includes Utility, so Utility is built first.
const FIXTURES = [
  {
    namespace: 'Utility',
    library: 'utility',
    identifierPrefix: 'Utility',
    symbolPrefix: 'utility_',
    sources: ['utility.c'],
    headers: ['utility.h'],
    packages: ['gobject-2.0'],
    includes: ['GObject-2.0'],
  },
  {
    namespace: 'GIMarshallingTests',
    library: 'gimarshallingtests',
    identifierPrefix: 'GIMarshallingTests',
    symbolPrefix: 'gi_marshalling_tests_',
    sources: ['gimarshallingtests.c', 'gimarshallingtestsextra.c'],
    headers: ['gimarshallingtests.h', 'gimarshallingtestsextra.h'],
    packages: ['gobject-2.0', 'gio-2.0'],
    includes: ['Gio-2.0'],
  },
  {
    namespace: 'Regress',
    library: 'regress',
    identifierPrefix: 'Regress',
    symbolPrefix: 'regress_',
    sources: ['annotation.c', 'drawable.c', 'foo.c', 'regress.c', 'regressextra.c'],
    headers: ['annotation.h', 'drawable.h', 'foo.h', 'regress.h', 'regressextra.h'],
    packages: ['gobject-2.0', 'gio-2.0', 'cairo', 'cairo-gobject'],
    includes: ['Gio-2.0', 'cairo-1.0', 'Utility-1.0'],
  },
]

function log(...args) {
  console.log('[fixtures]', ...args)
}
function vlog(...args) {
  if (VERBOSE) console.log('[fixtures]', ...args)
}

function pkgConfig(args) {
  return execSync(`pkg-config ${args}`, { encoding: 'utf8' }).trim()
}

function which(bin) {
  try {
    return execFileSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).trim()
  } catch (e) {
    return null
  }
}

function fixtureIsPresent(fixture) {
  const typelib = path.join(FIXTURES_DIR, `${fixture.namespace}-1.0.typelib`)
  const lib = path.join(FIXTURES_DIR, `lib${fixture.library}.so`)
  return fs.existsSync(typelib) && fs.existsSync(lib)
}

// Download + extract the pinned upstream sources once; return the dir holding
// the .c/.h files. Cached under SRC_CACHE_DIR/<ref>, keyed by revision.
function ensureSources() {
  const destDir = path.join(SRC_CACHE_DIR, SOURCE_REF)
  // The repo's files live at the tarball root; a marker file confirms a
  // complete previous extraction.
  if (fs.existsSync(path.join(destDir, 'gimarshallingtests.c'))) {
    vlog(`sources present at ${destDir}`)
    return destDir
  }

  fs.mkdirSync(SRC_CACHE_DIR, { recursive: true })
  const tarball = path.join(SRC_CACHE_DIR, `${SOURCE_REF}.tar.gz`)
  const url = `${SOURCE_REPO}/-/archive/${SOURCE_REF}/src-${SOURCE_REF}.tar.gz`

  log(`downloading test sources @ ${SOURCE_REF.slice(0, 12)}`)
  execFileSync('curl', ['-fsSL', url, '-o', tarball], { stdio: VERBOSE ? 'inherit' : 'pipe' })

  // The tarball extracts to a single top-level dir; strip it into destDir.
  fs.mkdirSync(destDir, { recursive: true })
  execFileSync('tar', ['xzf', tarball, '-C', destDir, '--strip-components=1'],
    { stdio: VERBOSE ? 'inherit' : 'pipe' })
  fs.unlinkSync(tarball)
  return destDir
}

function buildFixture(fixture, srcDir, tools) {
  const sources = fixture.sources.map(s => path.join(srcDir, s))
  const headers = fixture.headers.map(h => path.join(srcDir, h))
  if (![...sources, ...headers].every(fs.existsSync)) {
    throw new Error(`sources for ${fixture.namespace} missing in ${srcDir}`)
  }

  const cflags = pkgConfig(`--cflags ${fixture.packages.join(' ')}`)
  const libs = pkgConfig(`--libs ${fixture.packages.join(' ')}`)
  const libPath = path.join(FIXTURES_DIR, `lib${fixture.library}.so`)
  const girPath = path.join(FIXTURES_DIR, `${fixture.namespace}-1.0.gir`)
  const typelibPath = path.join(FIXTURES_DIR, `${fixture.namespace}-1.0.typelib`)

  // 1. shared library
  const cc = process.env.CC || 'cc'
  const compileCmd =
    `${cc} -shared -fPIC -I"${srcDir}" ${cflags} ` +
    `${sources.map(s => `"${s}"`).join(' ')} ${libs} -o "${libPath}"`
  vlog(compileCmd)
  execSync(compileCmd, { stdio: VERBOSE ? 'inherit' : 'pipe' })

  // 2. introspection data (.gir)
  const scanArgs = [
    ...sources, ...headers,
    '--warn-all',
    '--namespace', fixture.namespace,
    '--nsversion', '1.0',
    '--identifier-prefix', fixture.identifierPrefix,
    '--symbol-prefix', fixture.symbolPrefix,
    '--library', fixture.library,
    '--library-path', FIXTURES_DIR,
    // So that --include of an already-built local fixture (e.g. Utility-1.0,
    // which Regress depends on) resolves its .gir from our output dir.
    '--add-include-path', FIXTURES_DIR,
    ...fixture.includes.flatMap(i => ['--include', i]),
    ...fixture.packages.flatMap(p => ['--pkg', p]),
    '--cflags-begin', ...cflags.split(/\s+/).filter(Boolean), `-I${srcDir}`, '--cflags-end',
    '--output', girPath,
  ]
  vlog(tools.scanner, scanArgs.join(' '))
  execFileSync(tools.scanner, scanArgs, {
    stdio: VERBOSE ? 'inherit' : 'pipe',
    env: { ...process.env, LD_LIBRARY_PATH: `${FIXTURES_DIR}:${process.env.LD_LIBRARY_PATH || ''}` },
  })

  // 3. compiled typelib (--includedir resolves locally-built included girs)
  execFileSync(tools.compiler, [girPath, '--includedir', FIXTURES_DIR, '--output', typelibPath], {
    stdio: VERBOSE ? 'inherit' : 'pipe',
  })

  log(`built ${fixture.namespace}`)
  return true
}

function main() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true })

  const allPresent = FIXTURES.every(fixtureIsPresent)
  if (!FORCE && allPresent) {
    vlog('all fixtures already present, skipping (use --force to rebuild)')
    log(`available fixtures: ${FIXTURES.map(f => f.namespace).join(', ')}`)
    return
  }

  const tools = {
    scanner: which('g-ir-scanner'),
    compiler: which('g-ir-compiler'),
  }
  if (!tools.scanner || !tools.compiler || !which('curl') || !which('tar')) {
    log('WARNING: g-ir-scanner/g-ir-compiler/curl/tar not all available; ' +
      'cannot build fixtures. Dependent tests will skip.')
    return
  }

  let srcDir
  try {
    srcDir = ensureSources()
  } catch (e) {
    log(`WARNING: could not fetch test sources: ${e.message.split('\n')[0]}`)
    log('dependent tests will skip')
    return
  }

  const results = []
  for (const fixture of FIXTURES) {
    if (!FORCE && fixtureIsPresent(fixture)) {
      vlog(`${fixture.namespace} already present, skipping`)
      results.push({ fixture, ok: true })
      continue
    }
    let ok = false
    try {
      ok = buildFixture(fixture, srcDir, tools)
    } catch (e) {
      log(`failed to build ${fixture.namespace}: ${e.message.split('\n')[0]}`)
    }
    if (!ok)
      log(`WARNING: could not provide ${fixture.namespace}; dependent tests will skip`)
    results.push({ fixture, ok })
  }

  const provided = results.filter(r => r.ok).map(r => r.fixture.namespace)
  log(`available fixtures: ${provided.length ? provided.join(', ') : '(none)'}`)
}

if (require.main === module)
  main()

module.exports = { FIXTURES_DIR, FIXTURES }
