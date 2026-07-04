/*
 * value__list_in_transfer_none.js
 *
 * Regression test for the transfer-none list IN-argument element over-unref.
 *
 * A transfer-none GList/GSList IN argument borrows its elements: node-gtk
 * builds the temporary list from the wrappers' pointers without adding any
 * reference, so it must not unref the elements when it frees the list after
 * the call. FreeGIArgument used to free list elements with OUT/EVERYTHING
 * semantics, calling g_object_unref on every GObject element — stealing one
 * reference per element from their real owners.
 *
 * In the wild (mariner file manager): Gdk.FileList.newFromList(files) stole a
 * ref from every GFile on each drag; the files were finalized while the drag's
 * GdkContentProvider still held them, and dropping the provider crashed in
 * g_object_unref on freed memory (SIGSEGV in
 * g_type_check_instance_is_fundamentally_a).
 */

const gi = require('../lib/')
const { describe, it, expect } = require('./__common__.js')

let Gdk
try {
  Gdk = gi.require('Gdk', '4.0')
} catch (e) {
  console.log('Gdk 4.0 not available, skipping:', e.message)
  process.exit(222) // the runner treats exit 222 as skip
}

const Gio = gi.require('Gio', '2.0')

describe('transfer-none list IN argument', () => {
  it('does not steal references from the elements', () => {
    const file = Gio.File.newForPath('/tmp/node-gtk-test-a')

    // The wrapper's toggle ref is the only reference.
    expect(gi.System.refCount(file), 1)

    // gdk_file_list_new_from_list(files: transfer-none GSList<GFile>) deep
    // copies the list, adding one ref per file: the file is now owned by its
    // wrapper and by the GdkFileList. Before the fix, node-gtk then unref'd
    // each element while freeing its temporary GSList, stealing the reference
    // the copy just took — leaving the file one GC away from use-after-free.
    const list = Gdk.FileList.newFromList([file])

    expect(gi.System.refCount(file), 2)

    // Keep the list (and its references) alive until here.
    expect(list.getFiles().length, 1)
  })
})
