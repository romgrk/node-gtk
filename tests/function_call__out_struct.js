const gi = require('../lib/')
const GObject = gi.require('GObject', '2.0')
const GLib = gi.require('GLib', '2.0')
const { describe, expect, it } = require('./__common__.js')

describe('get output arguments type struct', () => {

  it('works with transfer == "NOTHING"', () => {
    const [res0, time] = GLib.timeValFromIso8601('2020-06-22T09:50:37Z')
    const isoString = time.toIso8601()
    expect(isoString, '2020-06-22T09:50:37Z')
  })

  // it('works with transfer == "EVERYTHING"', () => {})
  // it('works with transfer == "CONTAINER"',  () => {})

  /*
   * No viable candidate found for the cases above, but some
   * might be found by investagating more libraries. This script
   * will return candidates:
   * @example
   *   const i = require('../lib/inspect')
   *
   *   i.parseNamespace('Gtk', '3.0')
   *   // i.parseNamespace(...)
   *
   *   const candidates = i.infos.filter(i =>
   *     i.infoType === 'function'
   *     && i.n_args > 0
   *     && !i.isConstructor
   *     && i.args.some(a =>
   *       (a.direction === 'OUT' || a.direction === 'INOUT')
   *       && a.transfer !== 'NOTHING'
   *       && a.type.startsWith('struct.')))
   *
   */
})
