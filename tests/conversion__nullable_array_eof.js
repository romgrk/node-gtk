/*
 * conversion__nullable_array_eof.js
 *
 * A nullable `char*`/byte-array return (annotated `nullable="1"` in the GIR)
 * must surface a NULL C pointer as JS `null`, not as an empty array/string, so
 * that end-of-stream stays distinguishable from a legitimately empty line.
 * Regression test for #467.
 */

const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gio = gi.require('Gio')
const { describe, expect } = require('./__common__.js')

function makeStream(text) {
  const bytes = GLib.Bytes.new([...Buffer.from(text)])
  return Gio.DataInputStream.new(Gio.MemoryInputStream.newFromBytes(bytes))
}

describe('read_line: EOF is null, empty line is []', () => {
  // "a\n\nb\n" => "a", "" (empty line), "b", then EOF
  const dis = makeStream('a\n\nb\n')

  const [l0] = dis.readLine(null)
  expect(l0, [0x61]) // "a"

  const [l1] = dis.readLine(null)
  expect(l1, []) // empty line — genuinely empty, NOT eof

  const [l2] = dis.readLine(null)
  expect(l2, [0x62]) // "b"

  const [eof] = dis.readLine(null)
  expect(eof, null) // end-of-stream is null, not []
})

describe('read_line: empty stream reads null immediately', () => {
  const dis = makeStream('')
  const [eof] = dis.readLine(null)
  expect(eof, null)
})

describe('read_line_utf8: EOF is null, empty line is ""', () => {
  const dis = makeStream('a\n\nb\n')

  const [l0] = dis.readLineUtf8(null)
  expect(l0, 'a')

  const [l1] = dis.readLineUtf8(null)
  expect(l1, '') // empty line — genuinely empty, NOT eof

  const [l2] = dis.readLineUtf8(null)
  expect(l2, 'b')

  const [eof] = dis.readLineUtf8(null)
  expect(eof, null) // end-of-stream is null, not ""
})
