/*
 * signal__once_off.js
 *
 * Regression test: a `once()` listener must be cancellable with
 * `off(event, originalCallback)` (matching Node EventEmitter semantics).
 * Previously `once` stored its internal wrapper as the listener map key,
 * so `off` with the user's original callback could not find it.
 */

const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const { describe, it, expect } = require('./__common__.js')

gi.startLoop()
Gtk.init()

describe('once', () => {
  it('can be cancelled with off(originalCallback)', () => {
    const button = new Gtk.Button()
    let calls = 0
    const cb = () => { calls++ }

    button.once('clicked', cb)
    button.off('clicked', cb)
    button.clicked()

    expect(calls, 0)
  })

  it('still fires exactly once when not cancelled', () => {
    const button = new Gtk.Button()
    let calls = 0

    button.once('clicked', () => { calls++ })
    button.clicked()
    button.clicked()

    expect(calls, 1)
  })
})
