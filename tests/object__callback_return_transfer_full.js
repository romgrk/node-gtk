/*
 * object__callback_return_transfer_full.js
 *
 * Regression test for the transfer-full callback-return use-after-free.
 *
 * When a JS callback's return value is transfer-full, the C caller takes
 * ownership of one reference (e.g. GtkTreeListModelCreateModelFunc returns a
 * `(transfer full) GListModel`). node-gtk marshalled the return by unwrapping
 * the pointer only, leaving itself holding just the wrapper's toggle ref — so
 * the caller effectively "owned" that toggle ref. The refcount never accounted
 * for the new owner, no toggle-up fired, the wrapper stayed weak, and once GC
 * collected it the object was finalized while the caller still used it. In the
 * wild this crashed in gtk_tree_list_model_finalize, disconnecting its
 * items-changed handler from an already-freed per-row child model.
 *
 * This mirrors that exact path: a GtkTreeListModel whose create-func returns a
 * fresh Gio.ListStore per expanded row. We keep the tree alive, drop every JS
 * reference to the child models, and force GC. The tree still owns each child,
 * so with the fix none are collected (their wrappers stay strong); with the bug
 * they are finalized out from under the tree (and a later tree teardown would be
 * a use-after-free). The IN-argument counterpart is object__* / #439.
 */

const gi = require('../lib/')
const { describe } = require('./__common__.js')

if (typeof global.gc !== 'function') {
  console.error('test must run with --expose-gc')
  process.exit(1)
}

const GObject = gi.require('GObject', '2.0')
const Gio = gi.require('Gio', '2.0')

let Gtk
try {
  Gtk = gi.require('Gtk', '4.0')
} catch (e) {
  console.log('Gtk 4.0 not available, skipping:', e.message)
  process.exit(222) // the runner treats exit 222 as skip
}

describe('a transfer-full GObject returned from a callback is kept alive by the C owner', async () => {
  const N = 100
  let childCollected = 0
  const registry = new FinalizationRegistry(() => { childCollected++ })

  // Root model: N expandable rows.
  const root = Gio.ListStore.new(GObject.TYPE_OBJECT)
  for (let i = 0; i < N; i++)
    root.append(new GObject.Object())

  // The create-func hands GtkTreeListModel a fresh child model per row with
  // `(transfer full)` ownership — the tree keeps it and connects items-changed.
  // We register each child so we can observe whether GC reclaims it.
  const tree = Gtk.TreeListModel.new(root, false, false, (_item) => {
    const child = Gio.ListStore.new(GObject.TYPE_OBJECT)
    registry.register(child)
    return child // the only strong JS reference dies when this closure returns
  })

  // Expand every root row so the tree realizes (and retains) a child model for
  // each — the same thing FileTree does on directory expand.
  for (let i = 0; i < N; i++) {
    const row = tree.getRow(i)
    row.setExpanded(true)
  }

  // Drop every JS reference to the child models and force GC. The tree is still
  // alive and owns each child, so a correctly-transferred reference keeps them
  // from being finalized.
  for (let g = 0; g < 12 && childCollected === 0; g++) {
    global.gc()
    await new Promise(r => setImmediate(r))
  }

  if (childCollected !== 0)
    throw new Error(
      `child models were finalized while the GtkTreeListModel still owns them: ` +
      `${childCollected}/${N} collected — the transfer-full callback return did not ` +
      `add the owning reference (use-after-free on tree teardown)`)

  // Sanity: the tree is still usable and can be torn down without a UAF.
  if (tree.getNItems() < N)
    throw new Error(`expected at least ${N} rows, got ${tree.getNItems()}`)
})
