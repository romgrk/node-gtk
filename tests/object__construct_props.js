/*
 * object__construct_props.js
 *
 * Construct-time properties passed in the initializer object may be written in
 * camelCase (idiomatic JS), underscored, or dashed — all are normalized to the
 * GObject canonical (dashed) property name (#320).
 */

const gi = require('../lib')
const Gtk = gi.require('Gtk', '3.0')
const { describe, it, expect, mustThrow } = require('./__common__.js')

Gtk.init([])

describe('construct props', () => {
  it('accepts camelCase / underscore / dashed names (#320)', () => {
    expect(new Gtk.Image({ iconName: 'folder' }).iconName, 'folder')
    expect(new Gtk.Image({ icon_name: 'edit' }).iconName, 'edit')
    expect(new Gtk.Image({ 'icon-name': 'go-up' }).iconName, 'go-up')
  })

  it('still rejects unknown names', mustThrow(
    'Invalid property name: does-not-exist',
    () => { new Gtk.Image({ doesNotExist: 1 }) }
  ))
})
