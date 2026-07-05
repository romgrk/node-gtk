/*
 * util.js — small helpers shared by the bundle tool.
 */

const fs = require('fs')
const path = require('path')
const child_process = require('child_process')

function exec(command, options = {}) {
  return child_process.execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  })
}

// Best-effort exec: undefined on failure instead of throwing.
function tryExec(command, options) {
  try { return exec(command, options) } catch (e) { return undefined }
}

function exists(p) {
  try { fs.accessSync(p); return true } catch (e) { return false }
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

// Copy a single file, dereferencing symlinks and preserving the mode.
function copyFile(src, dest) {
  mkdirp(path.dirname(dest))
  fs.copyFileSync(src, dest)
  fs.chmodSync(dest, fs.statSync(src).mode)
}

// Copy a directory tree, dereferencing symlinks (pnpm installs are symlink
// forests; the bundle must contain real files).
function copyTree(src, dest, options = {}) {
  fs.cpSync(src, dest, { recursive: true, dereference: true, force: true, ...options })
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  if (bytes >= 1024)
    return (bytes / 1024).toFixed(1) + ' kB'
  return bytes + ' B'
}

function dirSize(dir) {
  if (!exists(dir))
    return 0
  const stat = fs.lstatSync(dir)
  if (!stat.isDirectory())
    return stat.size
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory())
      total += dirSize(p)
    else if (entry.isFile())
      total += fs.lstatSync(p).size
  }
  return total
}

module.exports = {
  exec,
  tryExec,
  exists,
  mkdirp,
  copyFile,
  copyTree,
  formatSize,
  dirSize,
}
