const gi = require('../lib/')
const GLib = gi.require('GLib', '2.0')
const common = require('./__common__.js')

common.describe('get output arguments type struct', () => {
  // transfer = NOTHING
  const [res0, time] = GLib.timeValFromIso8601('2020-06-22T09:50:37Z')
  const isoString = time.toIso8601()
  common.expect(isoString, '2020-06-22T09:50:37Z')

  // transfer = EVERYTHING
  const regex = new GLib.Regex('[A-Z]+', 0, 0)
  const [res1, match] = regex.match('Hello World', 0)
  const matches = []
  while (match.matches()) {
    const word = match.fetch(0)
    matches.push(word)
    match.next(null)
  }
  match.free()
  regex.unref()

  common.expect(matches.length, 2)
  common.expect(matches[0], 'H')
  common.expect(matches[1], 'W')
})
