# API

This is the documentation for the API of node-gtk itself. For documentation on the specific modules (`Gtk`, `Gdk`, etc) refer to their own documentation. Usually https://developer.gnome.org/ is a good source though you'll need to search in `lower_snake_case` as it's a C API.

### Exports

- **[require(ns, [version])](#require)**
- **[prependSearchPath(path)](#prepend-search-path)**
- **[prependLibraryPath(path)](#prepend-library-path)**

<a id="require" />

#### require(ns, [version]) ⇒ `Object`

Requires a module. Automatically loads dependencies.

**Returns**: `Object` - the loaded module

| Param   | Type     | Default | Description                       |
| ------- | -------- | ------- | --------------------------------- |
| ns      | `string` |         | namespace to load                 |
| version | `string` | `null`  | version to load (null for latest) |

<a id="prepend-search-path" />

#### prependSearchPath(path)

Prepends a path to GObject-Introspection search path (for typelibs)

| Param | Type     |
| ----- | -------- |
| path  | `string` |

<a id="prepend-library-path" />

#### prependLibraryPath(path)

Prepends a path to GObject-Introspection library path (for shared libraries)

| Param | Type     |
| ----- | -------- |
| path  | `string` |

### Signals (event handlers)

Signals (or events, in NodeJS semantics) are dispatched through the usual `.on`,
`.off`, and `.once` methods.

Returning `true` from an event handler can have the special semantic of stopping the event
from being propagated or preventing the default behavior. Refer to GTK documentation for details.
(E.g. [GtkWidget signals](https://developer.gnome.org/gtk3/stable/GtkWidget.html#GtkWidget.signals))

```javascript
const input = new Gtk.Entry()

/**
 * GObject.on - associates a callback to an event
 * @param {String} name - Name of the event
 * @param {Function} callback - Event handler
 */
input.on('key-press-event', onKeyPress)

/**
 * GObject.off - dissociates callback from an event
 * @param {String} name - Name of the event
 * @param {Function} callback - Event handler
 */
input.off('key-press-event', onKeyPress)

/**
 * GObject.once - as GObject.on, but only runs once
 * @param {String} name - Name of the event
 * @param {Function} callback - Event handler
 */
input.once('key-press-event', onKeyPress)

function onKeyPress(event) {
  // event.__proto__ === Gdk.EventKey
  console.log(event.string, event.keyval)
}
```

Low-level methods `.connect(name: String, callback: Function) : Number` and
`.disconnect(name: String, handleID: Number) : void` are also available.

### GTK

For GTK objects and functions documentation, please refer to [gnome documentation](https://developer.gnome.org/gtk3/stable/), or any other GIR generated documentation as [valadoc](https://valadoc.org/gtk+-3.0/index.htm).

### Naming conventions

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

