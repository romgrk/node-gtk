/*
 * fundamental__gsk_render_node.js
 *
 * Regression test for #468: Gtk.Snapshot.toNode() returns a GskRenderNode,
 * which is a fundamental ref-counted type (gsk_render_node_ref/unref), NOT a
 * GObject. node-gtk used to run its GObject wrapper path over it, firing 8
 * `G_IS_OBJECT` GLib-GObject criticals per call. It must now wrap it as its
 * own fundamental type with no criticals.
 */

const gi = require('../lib/')
const { describe, it, expect, assert, isntUndefined, skip } = require('./__common__.js')
const child_process = require('child_process')

let Gtk, Gdk, Graphene, Gsk
try {
  Gtk = gi.require('Gtk', '4.0')
  Gdk = gi.require('Gdk', '4.0')
  Graphene = gi.require('Graphene', '1.0')
  Gsk = gi.require('Gsk', '4.0')
  Gtk.init()
} catch (e) {
  console.log('Gtk 4.0 not available, skipping:', e.message)
  skip()
}

function makeNode() {
  const snapshot = Gtk.Snapshot.new()
  const color = new Gdk.RGBA()
  color.red = 1
  color.alpha = 1
  const rect = new Graphene.Rect()
  rect.init(0, 0, 10, 10)
  snapshot.appendColor(color, rect)
  return snapshot.toNode()
}

// Child mode: exercise the repro then force GC so the fundamental teardown
// (unref) runs too. Under G_DEBUG=fatal-criticals any g_object_* call on the
// non-GObject node aborts the process, so a clean exit proves the fix.
if (process.env.NODE_GTK_468_CHILD) {
  const node = makeNode()
  // Touch a GskRenderNode method to prove the wrapper is usable.
  node.getNodeType()
  if (global.gc) {
    global.gc()
    global.gc()
  }
  process.exit(0)
}

describe('Gsk.RenderNode fundamental-type wrapping (#468)', () => {

  it('wraps a GskRenderNode as its own fundamental type with working methods', () => {
    const node = makeNode()
    isntUndefined(node, 'toNode() returned undefined')
    assert(node !== null, 'toNode() returned null')

    // It is a GskRenderNode subclass and inherits the fundamental base.
    expect(node.constructor.name, 'GskColorNode')
    assert(typeof node.getNodeType === 'function',
      'expected introspected GskRenderNode method getNodeType()')

    // Calling a method (which unwraps `this` back to the native pointer) works.
    const nodeType = node.getNodeType()
    expect(nodeType, Gsk.RenderNodeType.COLOR_NODE)
  })

  it('produces no G_IS_OBJECT criticals on wrap, use and teardown', () => {
    const child = child_process.spawnSync(
      process.execPath,
      ['--expose-gc', __filename],
      {
        encoding: 'utf8',
        env: Object.assign({}, process.env, {
          NODE_GTK_468_CHILD: '1',
          G_DEBUG: 'fatal-criticals',
          NODE_GTK_FUND_DEBUG: '1',
        }),
      }
    )

    const output = (child.stderr || '') + (child.stdout || '')
    assert(!/CRITICAL|G_IS_OBJECT/.test(output),
      'expected no GObject criticals, got:\n' + output)
    assert(child.status === 0,
      'child exited with status ' + child.status + ' signal ' + child.signal + '\n' + output)
  })

})
