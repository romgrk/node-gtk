/*
 * app-tree.js — copy the application into <bundle>/app/.
 *
 * Two parts:
 *  1. the app's own files, selected by the `include` globs of the config,
 *  2. its production node_modules: the dependency closure walked from the
 *     app's package.json, with symlinks dereferenced (pnpm installs are
 *     symlink forests; the bundle needs real files).
 *
 * node-gtk itself is special-cased: only package.json + lib/ ship, with a
 * single lib/binding/<abi> directory (the one matching the bundled node), and
 * its build-time dependencies (node-pre-gyp, node-gyp, nan) are omitted —
 * lib/native.js only requires node-pre-gyp when the direct binding path is
 * missing, which the bundler guarantees never happens.
 */

const fs = require('fs')
const path = require('path')

const { exists, mkdirp, copyFile, copyTree } = require('./util.js')

// Packages never copied into a bundle. Config `omitPackages` adds to this.
const DEFAULT_OMIT = ['@mapbox/node-pre-gyp', 'node-gyp', 'nan']

// Directory names never copied from the app or from packages.
const ALWAYS_EXCLUDED_DIRS = new Set(['node_modules', '.git'])

// Top-level app directories excluded from the default '**/*' include: build
// output — including previous bundles — must not be re-bundled. An app that
// keeps runtime assets in one of these lists it in `include` explicitly.
const DEFAULT_EXCLUDED_OUTPUT_DIRS = new Set(['dist', 'out', 'build'])

function copyApp(ctx) {
  const { config, appDir, appOutDir, log } = ctx

  // --- 1. app files -------------------------------------------------------
  const outRoot = path.resolve(ctx.outBase)
  const usesDefaultInclude = config.include.length === 1 && config.include[0] === '**/*'
  const excludeFn = entry => {
    const name = typeof entry === 'string' ? entry : entry.name
    const base = path.basename(name)
    if (ALWAYS_EXCLUDED_DIRS.has(base))
      return true
    const abs = path.resolve(appDir, name)
    // never re-bundle bundle output (previous trees or their archives)
    if (abs === outRoot || abs.startsWith(outRoot + '.'))
      return true
    if (usesDefaultInclude && DEFAULT_EXCLUDED_OUTPUT_DIRS.has(name))
      return true
    return false
  }

  const matches = fs.globSync(config.include, { cwd: appDir, exclude: excludeFn })
  let fileCount = 0
  for (const match of matches) {
    const src = path.join(appDir, match)
    if (path.resolve(src) === outRoot || !fs.statSync(src).isFile())
      continue
    copyFile(src, path.join(appOutDir, match))
    fileCount += 1
  }

  // package.json always ships: node needs it for "type"/"main" resolution.
  copyFile(path.join(appDir, 'package.json'), path.join(appOutDir, 'package.json'))

  if (!exists(path.join(appOutDir, config.entry)))
    throw new Error(`entry '${config.entry}' was not copied into the bundle — check the 'include' globs`)

  log(`app: ${fileCount} files (include: ${config.include.join(', ')})`)

  // --- 2. production dependencies -----------------------------------------
  const omit = new Set([...DEFAULT_OMIT, ...config.omitPackages])
  const packages = collectPackages(appDir, omit)

  for (const [name, dir] of packages) {
    const dest = path.join(appOutDir, 'node_modules', name)
    if (name === 'node-gtk')
      copyNodeGtk(ctx, dir, dest)
    else
      copyTree(dir, dest, { filter: src => !ALWAYS_EXCLUDED_DIRS.has(path.basename(src)) })
  }

  log(`app: ${packages.size} packages (${[...packages.keys()].join(', ')})`)

  const bindingPath = findBinding(ctx, appOutDir)
  return { bindingPath }
}

// Walk the production dependency closure. Resolution mimics require(): look
// for node_modules/<name> in the requiring package's directory, then upward.
// Every hit is realpath'd, which naturally follows pnpm's .pnpm store layout
// (a package's own deps then resolve inside its .pnpm/<id>/node_modules).
function collectPackages(appDir, omit) {
  const found = new Map() // name -> real package dir
  const visit = pkgDir => {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies }
    for (const name of Object.keys(deps)) {
      if (omit.has(name) || found.has(name))
        continue
      const dir = resolvePackageDir(name, pkgDir)
      if (dir === undefined) {
        if (pkg.optionalDependencies !== undefined && name in pkg.optionalDependencies)
          continue
        throw new Error(`cannot resolve dependency '${name}' from ${pkgDir} — is the app installed?`)
      }
      found.set(name, dir)
      visit(dir)
    }
  }
  visit(appDir)
  return found
}

function resolvePackageDir(name, fromDir) {
  let dir = fromDir
  while (true) {
    const candidate = path.join(dir, 'node_modules', name)
    if (exists(path.join(candidate, 'package.json')))
      return fs.realpathSync(candidate)
    const parent = path.dirname(dir)
    if (parent === dir)
      return undefined
    dir = parent
  }
}

// node-gtk trimmed to its runtime files: package.json + lib/, and within
// lib/binding only the ABI directory matching the bundled node binary.
function copyNodeGtk(ctx, srcDir, destDir) {
  const bindingName = ctx.bindingName
  copyTree(srcDir, destDir, {
    filter: src => {
      const rel = path.relative(srcDir, src)
      if (rel === '')
        return true
      const parts = rel.split(path.sep)
      if (parts[0] === 'package.json')
        return true
      if (parts[0] !== 'lib')
        return false
      if (ALWAYS_EXCLUDED_DIRS.has(parts[parts.length - 1]))
        return false
      if (parts[1] === 'binding' && parts.length >= 3 && parts[2] !== bindingName)
        return false
      return true
    },
  })
}

function findBinding(ctx, appOutDir) {
  const bindingPath = path.join(
    appOutDir, 'node_modules', 'node-gtk', 'lib', 'binding', ctx.bindingName, 'node_gtk.node')
  if (!exists(bindingPath))
    throw new Error(
      `no compiled node-gtk addon for ${ctx.bindingName} — ` +
      `build node-gtk with the node you are bundling (${process.version}) first`)
  return bindingPath
}

module.exports = { copyApp }
