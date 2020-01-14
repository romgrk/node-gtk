/*
    Gtk objects are not being released  and this may be the cause of the errors reported in

    [node-gtk/issues/150](https://github.com/romgrk/node-gtk/issues/150)

    and other random crashes.


    ## Brief description:

    This examples assumes that gtk-node logs every time it creates and releases
    an object.

    It shows that objects are not being .unref()'ed for Gtk to know that the object is no
    longer referenced so it can release it.

    Run the example with

        xvfb-run node --expose-gc examples/releasing-gtk-references.js

    ## Detailed description

    When node does

        new Gtk.SomeObject()

    in the function GObjectConstructor it allocates a node object holding a reference to
    an object owned by Gtk.

    Gtk expects the program to call

        object.unref()

    once the object is no longer referenced.

    In other languages objects have an optional hook named .finalizer().

    When the garbage collector finds an object that is no longer referenced in the
    whole program and that it has finalizer hook defined it calls the object finalizer
    method right before disposing the object.

    The finalizer is used to release resources taken by the object like file handles,
    database connections or memory allocated by third party libraries.

    In this case it would do something along the lines of

        GtkObject.finalize = function() {
            this.unref()
        }

    This would tell Gtk to decrease the reference counter for that object and when it
    reaches 0 Gtk would call the object GObjectDestroyed.

    Node currently does not provide finalizer hooks out of the box but there are some
    third party implementations.

    Since currently node objects are being collected without decreasing their references
    to the Gtk handles they have taken on those objects are leaked.

    Worst than that, some ephemeral objects susbcribed to other Gtk signals are also
    leaked and they keep receiving notifications of the events even when they no longer
    exist in node or when other objects change, like Gtk.TreePath objects referencing a row that may no longer be valid, messing some pointers around and eventually crashing the app.

    One solution would be to make the programmer to release every gtk object by calling

        gtkObject.unref()

    but leaving the memory management to the programmer is error prone.

    Other solution would be to add a weak reference or finalizer implementation
    to properly decrease the ref counter of Gtk objects when they are garbage collected.

    Unfortunatly that would require adding a finalizer library as a dependency
    or adding some significant changes to the current implementation.
*/

const GNode = require('../lib/')
const Gtk = GNode.require('Gtk', '3.0')

GNode.startLoop()
Gtk.init()

const n = 10

console.log('Leaks the objects.')

for( let i = 0; i < n; i ++) {
    const object = new Gtk.ListStore();

    global.gc()
}

console.log('Releases the objects.')

for( let i = 0; i < n; i ++) {
    const object = new Gtk.ListStore();

    object.unref()

    global.gc()
}

console.log('Crashes trying to release the same object for the second time.')

for( let i = 0; i < n; i ++) {
    const object = new Gtk.ListStore();

    object.unref()

    global.gc()

    object.unref()

}