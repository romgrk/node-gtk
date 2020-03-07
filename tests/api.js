/*
 * api.js
 */


const os = require('os')
const gi = require('..')
const { describe, it, mustThrow, expect, assert } = require('./__common__.js')

describe('require', () => {
  const Gtk = gi.require('Gtk', '3.0')
  expect(typeof Gtk, 'object')
})

describe('startLoop', () => {
  gi.startLoop()
})

describe('prependSearchPath', () => {
  gi.prependSearchPath(os.tmpdir())
})

describe('prependLibraryPath', () => {
  gi.prependLibraryPath(os.tmpdir())
})

describe('listAvailableModules', async () => {
  const modules = await gi.listAvailableModules()

  const failedModules = modules.filter(module =>
    !(typeof module.name === 'string' &&
    typeof module.version === 'string' &&
    /^\d+(\.\d+)?$/.test(module.version))
  )
  console.log(failedModules)

  assert(
    failedModules.length === 0,
    'Module descriptions type check failed'
  )
})
