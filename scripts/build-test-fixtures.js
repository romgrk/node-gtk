/*
 * build-test-fixtures.js
 *
 * Makes the gobject-introspection test libraries (GIMarshallingTests, Regress)
 * available for node-gtk's test suite. These libraries ship with
 * gobject-introspection itself and systematically exercise marshalling of every
 * GObject type in every direction (in/out/inout/return), so they let us test
 * node-gtk's type conversions exhaustively instead of ad-hoc.
 *
 * Hybrid strategy:
 *   1. If prebuilt typelibs + shared libraries already exist on the system
 *      (e.g. the gjs `installed-tests` package), copy them into tests/gi-fixtures/.
 *   2. Otherwise, compile them from the sources bundled with the
 *      gobject-introspection devel package (gidatadir/tests) using
 *      g-ir-scanner / g-ir-compiler.
 *
 * Output: tests/gi-fixtures/{NAME}-1.0.typelib and lib{name}.so
 *
 * Run directly (`node scripts/build-test-fixtures.js`) or via `npm test`
 * (it runs as a pretest step). It is idempotent: existing fixtures are reused
 * unless --force is passed.
 */

const fs = require('fs')
const path = require('path')
const { execFileSync, execSync } = require('child_process')

const FIXTURES_DIR = path.join(__dirname, '..', 'tests', 'gi-fixtures')
const FORCE = process.argv.includes('--force')
const VERBOSE = process.argv.includes('--verbose') || process.env.VERBOSE

// Each fixture: the GI namespace, its shared-library basename, the source files
// (relative to gidatadir/tests) and the pkg-config packages it needs to build.
const FIXTURES = [
  {
    namespace: 'GIMarshallingTests',
    library: 'gimarshallingtests',
    identifierPrefix: 'GIMarshallingTests',
    symbolPrefix: 'gi_marshalling_tests',
    sources: ['gimarshallingtests.c'],
    headers: ['gimarshallingtests.h'],
    packages: ['gobject-2.0', 'gio-2.0'],
    includes: ['Gio-2.0'],
  },
  {
    // Regress depends on Utility, so it must be built/copied first.
    namespace: 'Utility',
    library: 'utility',
    identifierPrefix: 'Utility',
    symbolPrefix: 'utility',
    sources: ['utility.c'],
    headers: ['utility.h'],
    packages: ['gobject-2.0'],
    includes: [],
  },
  {
    namespace: 'Regress',
    library: 'regress',
    identifierPrefix: 'Regress',
    symbolPrefix: 'regress',
    sources: ['regress.c'],
    headers: ['regress.h'],
    packages: ['gobject-2.0', 'gio-2.0', 'cairo', 'cairo-gobject'],
    includes: ['Gio-2.0', 'cairo-1.0', 'Utility-1.0'],
  },
]

// Known locations where distros install prebuilt test typelibs + .so files.
const PREBUILT_DIRS = [
  '/usr/lib/installed-tests/gjs',
  '/usr/lib64/installed-tests/gjs',
  '/usr/lib/x86_64-linux-gnu/installed-tests/gjs',
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

// Strategy 1: reuse prebuilt typelib + shared library from the system.
// Set NO_PREBUILT=1 to force the build-from-source path (used to test it).
function tryReusePrebuilt(fixture) {
  if (process.env.NO_PREBUILT)
    return false

  const typelibName = `${fixture.namespace}-1.0.typelib`
  const libName = `lib${fixture.library}.so`

  for (const dir of PREBUILT_DIRS) {
    const typelibSrc = path.join(dir, typelibName)
    const libSrc = path.join(dir, libName)
    if (fs.existsSync(typelibSrc) && fs.existsSync(libSrc)) {
      fs.copyFileSync(typelibSrc, path.join(FIXTURES_DIR, typelibName))
      fs.copyFileSync(libSrc, path.join(FIXTURES_DIR, libName))
      log(`reused prebuilt ${fixture.namespace} from ${dir}`)
      return true
    }
  }
  return false
}

// Strategy 2: compile from the gobject-introspection bundled test sources.
function tryBuildFromSource(fixture, testsDir, tools) {
  const sources = fixture.sources.map(s => path.join(testsDir, s))
  const headers = fixture.headers.map(h => path.join(testsDir, h))
  if (![...sources, ...headers].every(fs.existsSync)) {
    vlog(`sources for ${fixture.namespace} not found in ${testsDir}, skipping`)
    return false
  }

  const cflags = pkgConfig(`--cflags ${fixture.packages.join(' ')}`)
  const libs = pkgConfig(`--libs ${fixture.packages.join(' ')}`)
  const libPath = path.join(FIXTURES_DIR, `lib${fixture.library}.so`)
  const girPath = path.join(FIXTURES_DIR, `${fixture.namespace}-1.0.gir`)
  const typelibPath = path.join(FIXTURES_DIR, `${fixture.namespace}-1.0.typelib`)

  // 1. shared library
  const cc = process.env.CC || 'cc'
  const compileCmd =
    `${cc} -shared -fPIC -I"${testsDir}" ${cflags} ` +
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
    '--cflags-begin', ...cflags.split(/\s+/).filter(Boolean), `-I${testsDir}`, '--cflags-end',
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

  log(`built ${fixture.namespace} from ${testsDir}`)
  return true
}

function main() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true })

  // Lazily resolved only if we need to build.
  let testsDir = null
  let tools = null
  const resolveBuildEnv = () => {
    if (tools) return tools.ok
    const scanner = which('g-ir-scanner')
    const compiler = which('g-ir-compiler')
    try {
      const gidatadir = pkgConfig('--variable=gidatadir gobject-introspection-1.0')
      testsDir = path.join(gidatadir, 'tests')
    } catch (e) {
      testsDir = null
    }
    tools = { scanner, compiler, ok: Boolean(scanner && compiler && testsDir && fs.existsSync(testsDir)) }
    return tools.ok
  }

  const results = []
  for (const fixture of FIXTURES) {
    if (!FORCE && fixtureIsPresent(fixture)) {
      vlog(`${fixture.namespace} already present, skipping (use --force to rebuild)`)
      results.push({ fixture, ok: true })
      continue
    }

    let ok = tryReusePrebuilt(fixture)
    if (!ok && resolveBuildEnv()) {
      try {
        ok = tryBuildFromSource(fixture, testsDir, tools)
      } catch (e) {
        log(`failed to build ${fixture.namespace}: ${e.message.split('\n')[0]}`)
      }
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
