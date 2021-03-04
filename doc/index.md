# Documentation

Node-Gtk is essentially a *thin* layer over native libraries. As such, understanding how to use the different gobject-introspected libraries depends on understanding first how the library itself works, second on how to call the library with node-gtk. This documentation covers the node-gtk part, and aims at giving you the information you need to be able to easily translate any C code into nodejs code. Refer to the library's documentation to understand how to use it.

#### Table of contents
  1. [Loading a library](#1.-loading-a-library)
  2. [Data types](#2.-data-types)
  3. [Structs & Unions](#3.-structs-&-unions)
  4. [GObjects](#4.-gobjects)
  5. [Naming conventions](#5.-naming-conventions)

## 1. Loading a library

Loading a library is done with simply with `gi.require(name: string, version: string)`. For example, GTK is loaded as
such:

```javascript
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
// Use GTK
```

See [api.md](./api.md) for more information on the `node-gtk` API.

## 2. Data types

The GLib Object System is a library and a set of C conventions used to implement an object-oriented type system in C,
which lacks such construct. When using a library, the different data types will be translated each in their own way.
Here are the main ones:

 - **Primitive types: integer, char, string**  
     Those types usually map directly to javascript types and don't require any
     special handling on your part.  
     Strings may be an exception to this rule in that they may be required to be
     passed as an array of bytes in some cases.
 - **Enums & Flags**  
     Those data types are converted to primitive javascript values. Flags are also
     known as bitmasks. They are grouped in objects.  
     For example, the `GTK_ALIGN_FILL` enum value is available as
     `Gtk.Align.FILL`.
 - **Structs & Unions (Boxed)**  
     Those are converted to javascript objects. Documented below.
 - **GObjects**  
     These are objects organized in a class hierarchy. Documented below.

## 3. Structs & Unions

These two types are called *boxed* types. They represent simple bags of data.
They may have several methods attached to them.

They can usually be created through a constructor if they have one, such as
[GdkRGBA](https://developer.gnome.org/gdk3/stable/gdk3-RGBA-Colors.html#GdkRGBA):

```javascript
const color = new Gdk.RGBA({
  red: 0.5,
  blue: 0.5,
  green: 0.5,
  alpha: 0.5
})
```

Or through a creation function, such as [GdkCursor](https://developer.gnome.org/gdk3/stable/gdk3-Cursors.html):

```javascript
const cursor = Gdk.Cursor.newFromName('pointer')
```

The boxed fields are accessible through dot-notation. **They are transformed in
lowerCamelCase notation**:

```javascript
console.log(color.red)
console.log(cursor.name)
```

## 4. GObjects

GObjects are the most important objects usually. They form the basis of the GTK
framework and represent instances of classes.

Similarly to boxed types, they can be created through a constructor or through a
creation function:

```javascript
// Constructor with initial properties
const label = new Gtk.Label({ text: "I'm a label!" })

// Creation function
const button = Gtk.Button.newFromStock(Gtk.STOCK_YES)
```

[GtkButton](https://developer.gnome.org/gtk3/stable/GtkButton.html)
and [GtkLabel](https://developer.gnome.org/gtk3/stable/GtkLabel.html)

They have access to their constructor methods, as well as all those of their
parents. For example, both elements above derive from [GtkWidget](https://developer.gnome.org/gtk3/stable/GtkWidget.html) and can access all its methods.

```javascript
console.log(label.getPreferredSize())
console.log(button.getPreferredSize())
```

Methods are transformed to use **lowerCamelCase** syntax and are called on their
instance. For example, the `getPreferredSize()` method's original C signature
reads like this:

```c
void
gtk_widget_get_preferred_size (GtkWidget *widget,
                               GtkRequisition *minimum_size,
                               GtkRequisition *natural_size);
```

Node-Gtk translates it so that you can call it directly on the instances, so
the new signature looks like this:

```javascript
GtkWidget.prototype.getPreferredSize = function() {
  /* C code called like this:
      gtk_widget_get_preferred_size(
        this,
        [out argument, handled by node-gtk],
        [out argument, handled by node-gtk])
  */
  /* [native code] */
  /* @returns [Gtk.Requisition, Gtk.Requisition]*/
}
```

#### Signals

GObjects also have their own event-emitting system, called signals. They are
usually connected with [`g_signal_connect`](https://developer.gnome.org/gobject/stable/gobject-Signals.html#g-signal-connect), and node-gtk makes them available through the more familiar `.on`/`.once`/`.off` syntax.

Here is an example with `GtkEntry`:

```javascript
const input = new Gtk.Entry()

/**
 * GObject.on - associates a callback to an event
 * @param {String} name - Name of the event
 * @param {Function} callback - Event handler
 * @param {Boolean} [after=false] - Run after the signal
 * @returns {GObject}
 */
input.on('key-press-event', onKeyPress, /* optional */ false)

/**
 * GObject.off - dissociates callback from an event
 * @param {String} name - Name of the event
 * @param {Function} callback - Event handler
 * @returns {GObject}
 */
input.off('key-press-event', onKeyPress)

/**
 * GObject.once - as GObject.on, but only runs once
 * @param {String} name - Name of the event
 * @param {Function} callback - Event handler
 * @param {Boolean} [after=false] - Run after the signal
 * @returns {GObject}
 */
input.once('key-press-event', onKeyPress, /* optional */ false)

function onKeyPress(event) {
  // event.__proto__ === Gdk.EventKey
  console.log(event.string, event.keyval)
}

/**
 * GObject.emit - Emits a signal on the GObject
 * @param {String} name - Name of the signal
 * @param {...*} args - Signal's arguments (refer to the library doc)
 */
input.emit('key-press-event', new Gdk.EventKey({ keyval: Gdk.Key_g }))

```

**NOTE:** Returning `GLib.SOURCE_CONTINUE` (`true`) or `GLib.SOURCE_REMOVE` (`false`) from an event handler can have the special semantic of continuing or stopping the event
from being propagated or preventing the default behavior. Refer to appropriate documentation for details.
(E.g. [GtkWidget signals](https://developer.gnome.org/gtk3/stable/GtkWidget.html#GtkWidget.signals))

Low-level methods `.connect(name: string, callback: Fn): number` and
`.disconnect(name: string, handleID: number): void` are also available but not
recommended.

## 5. Naming conventions

Here is a recap of the naming conventions.

- **Functions, Methods & Virtual Functions**: `lowerCamelCase`  
   Methods on GObject, structs, unions and functions on namespaces.  
   Example:  
   `GLib.randomIntRange(0, 100)`  
   `textBuffer.placeCursor(0)`

- **Fields & Properties**: `lowerCamelCase`  
   Fields are on structs and unions.  
   Properties are on GObjects.  
   Example:  
   `textView.showLineNumbers = true`  
   `new Gdk.Color().blue = 200`

- **Structs, Unions, GObjects & Interfaces**: `UpperCamelCase`  
   Defined on namespaces.  
   Example:  
   `Gtk.Button`  
   `Gdk.Color`

- **Enums, Flags**: `UpperCamelCase`  
   Defined on namespaces.  
   Example:  
   `Gtk.AttachOptions`  
   `Gdk.EventType`

- **Constants & Values**: `SNAKE_CASE` (not modified, may contain lowercase)  
   Can be attached on namespaces or on specific objects.  
   Example:  
   `Gdk.KEY_g !== Gdk.KEY_G`  
   `Gdk.EventType.KEY_PRESS`

- **Signals**: `dash-case`  
   Events triggered by GObjects.  
   Example:  
   `gtkEntry.on('key-press-event', (ev) => { ... })`

