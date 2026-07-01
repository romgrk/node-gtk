/*
 * interface__private_type.js
 *
 * Regression test for #441: methods coming from a GInterface must be available
 * directly on instances of private/non-introspectable concrete types (eg
 * GLocalFile, which implements the public GFile interface), not only on the
 * interface's prototype.
 */

const gi = require('../lib/')
const { describe, it, expect, assert } = require('./__common__.js')

const Gio = gi.require('Gio', '2.0')

describe('GInterface methods on private-type instances (#441)', () => {
  const file = Gio.File.newForPath('/tmp/node-gtk-example.txt')

  it('exposes interface methods directly on the instance', () => {
    expect(typeof file.getPath, 'function')
    expect(typeof file.getBasename, 'function')
    expect(typeof file.enumerateChildren, 'function')
  })

  it('interface methods return the correct values when called', () => {
    // getBasename() is separator-agnostic; getPath() round-trips the path GIO
    // stored, which uses the platform separator (`\` on Windows), so compare
    // structurally rather than against a hard-coded POSIX string.
    expect(file.getBasename(), 'node-gtk-example.txt')
    const path = file.getPath()
    assert(typeof path === 'string' && path.length > 0,
      `getPath() returns a non-empty string, got "${path}"`)
    assert(path.endsWith('node-gtk-example.txt'),
      `getPath() ends with the basename, got "${path}"`)
  })

  it('keeps the base GObject methods (mixing in must not clobber them)', () => {
    expect(typeof file.on, 'function')
    expect(typeof file.connect, 'function')
    expect(typeof file.toString, 'function')
  })

  it('works regardless of the declared return type', () => {
    // getChild() is declared to return the GFile interface, but the runtime
    // object is again a private GLocalFile.
    const child = Gio.File.newForPath('/tmp').getChild('a.txt')
    expect(child.getBasename(), 'a.txt')
  })

  it('shares a single fixed prototype across instances', () => {
    const a = Gio.File.newForPath('/a')
    const b = Gio.File.newForPath('/b')
    assert(Object.getPrototypeOf(a) === Object.getPrototypeOf(b),
      'instances of the same private type should share one prototype')
  })
})
