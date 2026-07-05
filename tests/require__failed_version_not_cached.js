/*
 * require__failed_version_not_cached.js
 *
 * A failed gi.require() (typelib not found) must not poison the module
 * cache. Apps probe for a version and fall back (try Gtk 4.0, catch, require
 * Gtk 3.0 — the bundle smoke app does exactly this); the empty module that
 * giRequire used to insert *before* the typelib lookup was returned by the
 * fallback require, yielding "Gtk.init is not a function".
 *
 * gi.isLoaded() had the same poisoning side effect (and always returned
 * false); it must reflect the repository without touching the cache.
 */

const gi = require('../lib/')
const { describe, it, assert, expect, mustThrow } = require('./__common__.js')

describe('gi.require after a failed require of the same namespace', () => {

  it('isLoaded is false before any require, without side effects', () => {
    expect(gi.isLoaded('Gtk'), false)
  })

  it('requiring a missing version throws', mustThrow(/Typelib file .* not found/, () => {
    gi.require('Gtk', '99.0')
  }))

  it('the fallback require returns a working module', () => {
    const Gtk = gi.require('Gtk') // whichever version is installed
    assert(typeof Gtk.init === 'function',
      `Gtk.init should be a function, got ${typeof Gtk.init} (poisoned cache?)`)
  })

  it('isLoaded reflects the loaded namespace', () => {
    expect(gi.isLoaded('Gtk'), true)
    expect(gi.isLoaded('Gtk', '99.0'), false)
  })
})
