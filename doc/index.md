# Documentation

node-gtk is a *thin* layer over native GObject-Introspection libraries. Using a
library therefore comes down to two things: understanding how the library itself
works, and knowing how to call it from Node. This guide covers the second part —
the node-gtk conventions you need to translate C (or any GObject) API into
JavaScript. For what a given function *does*, refer to the library's own
documentation.

> The examples below use GTK 4. node-gtk also supports GTK 3 (and any other
> introspected library) — just `gi.require()` the version you want.

#### Table of contents
  1. [Loading a library](#1-loading-a-library)
  2. [Data types](#2-data-types)
  3. [Structs and unions](#3-structs-and-unions)
  4. [GObjects](#4-gobjects)
  5. [Naming conventions](#5-naming-conventions)
  6. [Function calls](#6-function-calls)
  7. [Common pitfalls](#7-common-pitfalls)

## 1. Loading a library

Load a library with `gi.require(name: string, version?: string)`. For example,
GTK:

```javascript
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
// use Gtk
```

A process can only load one version of a given namespace, so pick the version up
front. See [api.md](./api.md) for the rest of the `node-gtk` API.

## 2. Data types

The GLib Object System (GObject) is a set of C libraries and conventions that add
an object-oriented type system to C. Each kind of type maps to JavaScript in its
own way:

- **Primitives — integer, float, boolean, string**  
    Map directly to JavaScript values; no special handling needed. (Strings
    occasionally need to be passed as a byte array — see the library's docs.)
- **Enums & flags**  
    Become plain values grouped in an object. `GTK_ORIENTATION_VERTICAL` is
    `Gtk.Orientation.VERTICAL`; flags (bitmasks) work the same way.
- **Structs & unions (boxed types)**  
    Become JavaScript objects with field access and methods — see
    [§3](#3-structs-and-unions).
- **GObjects**  
    Class instances organized in an inheritance hierarchy — see
    [§4](#4-gobjects).

## 3. Structs and unions

Structs and unions are *boxed* types — simple bags of data that may also carry a
few methods.

Create one with its constructor, if it has one (e.g.
[`Gdk.RGBA`](https://docs.gtk.org/gdk4/struct.RGBA.html)):

```javascript
const color = new Gdk.RGBA({ red: 0.5, green: 0.5, blue: 0.5, alpha: 1.0 })
```

…or with a creation function (e.g.
[`Gdk.Cursor`](https://docs.gtk.org/gdk4/class.Cursor.html)):

```javascript
const cursor = Gdk.Cursor.newFromName('pointer', null)
```

Fields are read and written with dot-notation, in **lowerCamelCase**:

```javascript
console.log(color.red)
color.alpha = 0.8
```

## 4. GObjects

GObjects are the heart of GTK: instances of classes arranged in a hierarchy. Like
boxed types, they're created with a constructor or a creation function:

```javascript
// Constructor with initial properties
const label = new Gtk.Label({ label: "I'm a label!" })

// Creation function
const button = Gtk.Button.newWithLabel('Click me')
```

([`Gtk.Label`](https://docs.gtk.org/gtk4/class.Label.html),
[`Gtk.Button`](https://docs.gtk.org/gtk4/class.Button.html))

An instance exposes every method of its class **and all its parents** — both
widgets above derive from
[`Gtk.Widget`](https://docs.gtk.org/gtk4/class.Widget.html), so they share its
whole API. Methods use **lowerCamelCase** and are called on the instance:

```javascript
label.setText('Hello')
console.log(label.getText()) // "Hello"
```

node-gtk rewrites each C function into an instance method: the leading
`this` argument is implicit and the name is camelCased. So this C signature:

```c
void gtk_label_set_text (GtkLabel *self, const char *str);
```

is called as `label.setText(str)`. Functions with *out-arguments* return them as
the result instead — see [§6](#6-function-calls).

#### Signals

GObjects emit events called **signals**. In C they're wired with
[`g_signal_connect`](https://docs.gtk.org/gobject/func.signal_connect.html);
node-gtk exposes the familiar `.on` / `.once` / `.off` / `.emit` API instead:

```javascript
const button = Gtk.Button.newWithLabel('Click me')

button.on('clicked', onClicked)            // run on every emission
button.once('clicked', onClicked)          // run at most once
button.off('clicked', onClicked)           // disconnect
button.emit('clicked')                     // emit manually

function onClicked() {
  console.log('clicked!')
}
```

`.on`/`.once` take an optional trailing `after` boolean to run the handler after
the default handler:

```javascript
button.on('clicked', onClicked, /* after */ true)
```

**Note:** the emitting instance is *not* passed to the callback (see
[#21](https://github.com/romgrk/node-gtk/issues/21)). Some signals use their
return value to control propagation or the default action (e.g. returning `true`
to stop a key event) — check the signal's documentation. The low-level
`.connect(name, callback): number` and `.disconnect(name, handlerId)` are also
available but rarely needed.

#### Inheritance

You can subclass an existing GObject. Register the subclass with the type system
so it's fully integrated and can override virtual functions:

```javascript
class CustomWidget extends Gtk.Widget {
  static GTypeName = 'NodeGTKCustomWidget'
  virtual_snapshot(snapshot) {} // overrides the `snapshot` virtual function
}
gi.registerClass(CustomWidget)
```

> **Register before you instantiate.** `new CustomWidget()` only works *after*
> `gi.registerClass(CustomWidget)`. Instantiating an unregistered subclass falls
> back to the abstract base type and aborts the process.

##### Virtual functions

To override a virtual function, define a method named **`virtual_`** followed by
the camelCase form of the vfunc name. node-gtk wires those — and *only* those —
into the GObject vtable:

| Virtual function (C / GIR) | Method to define |
| -------------------------- | ---------------- |
| `get_request_mode`         | `virtual_getRequestMode` |
| `measure`                  | `virtual_measure` |
| `size_allocate`            | `virtual_sizeAllocate` |
| `snapshot`                 | `virtual_snapshot` |
| `dispose`                  | `virtual_dispose` |

A plain method is **never** treated as an override, so naming a method `dispose`,
`getProperty` or `sizeAllocate` no longer silently hijacks the matching vfunc.
The prefix also keeps the override distinct from the public method of the same
name — `widget.sizeAllocate(rect, baseline)` calls the method, while
`virtual_sizeAllocate` overrides the vfunc.

Chain up to the implementation you overrode with `super.virtual_<name>()`:

```javascript
class CustomWidget extends Gtk.Widget {
  static GTypeName = 'NodeGTKCustomWidget'
  virtual_snapshot(snapshot) {
    super.virtual_snapshot(snapshot)   // draw the parent first
    /* ...then draw on top... */
  }
}
gi.registerClass(CustomWidget)
```

If a `virtual_*` method matches no vfunc on the parent or its interfaces,
`registerClass` throws — this catches typos like `virtual_mesure`.

## 5. Naming conventions

node-gtk normalizes names from the C/GIR style to JavaScript conventions:

| Kind | Convention | Example |
| --- | --- | --- |
| Functions & methods | `lowerCamelCase` | `GLib.randomIntRange(0, 100)`, `textBuffer.placeCursor(0)` |
| Virtual function overrides | `virtual_` + `lowerCamelCase` | `virtual_getRequestMode`, `virtual_sizeAllocate` |
| Fields & properties | `lowerCamelCase` | `textView.showLineNumbers = true`, `rgba.alpha = 0.5` |
| Structs, unions, GObjects, interfaces | `UpperCamelCase` | `Gtk.Button`, `Gdk.RGBA` |
| Enums & flags | `UpperCamelCase` | `Gtk.Orientation.VERTICAL`, `Gtk.Align.FILL` |
| Constants & values | `SNAKE_CASE` (unchanged) | `Gdk.KEY_g !== Gdk.KEY_G`, `Gtk.STYLE_PROVIDER_PRIORITY_USER` |
| Signals | `dash-case` | `button.on('clicked', …)` |

## 6. Function calls

Translating calls between C and JavaScript has a few gotchas, mostly because some
C concepts (like pointers) have no JavaScript equivalent.

#### Out-arguments

Out-arguments are parameters a C function fills in through a pointer instead of
returning. **When you call C from JS**, node-gtk allocates and unpacks them for
you: you don't pass them, and they come back as return values. If a call produces
more than one value (a real return plus an out-argument, or several
out-arguments), node-gtk returns them as an array, with the real return value
first.

**When C calls into your JS** — e.g. overriding the
[`measure`](https://docs.gtk.org/gtk4/vfunc.Widget.measure.html) virtual function
(`virtual_measure`) — the direction inverts: your function must *return* the
out-arguments, again with the real return value first if there is one.

```c
void
gtk_widget_measure (GtkWidget *widget,
                    GtkOrientation orientation,
                    int for_size,
                    int *minimum,
                    int *natural,
                    int *minimum_baseline,
                    int *natural_baseline);
```

```javascript
class NewWidget extends Gtk.Widget {
  static GTypeName = 'NodeGTKNewWidget'
  virtual_measure(orientation, forSize, ...outs) {
    // the out-argument slots arrive in `outs` as `null` placeholders
    // ...calculate dimensions...
    return [minimum, natural, minimumBaseline, naturalBaseline]
  }
}
```

## 7. Common pitfalls

The bindings give you direct access to C functions, so misusing a library can
crash the process. A few frequent mistakes:

<details>
  <summary><b>Forgetting to initialize GTK</b></summary>
  Call <code>Gtk.init()</code> before using anything from GTK.
</details>

<details>
  <summary><b>Instantiating a subclass before registering it</b></summary>
  Call <code>gi.registerClass(MyClass)</code> before <code>new MyClass()</code>;
  otherwise construction falls back to the abstract base type and aborts the
  process. See <a href="#4-gobjects">§4 → Inheritance</a>.
</details>

<details>
  <summary><b>Getting a display causes a segfault (X11)</b></summary>
  Backend-specific APIs live in their own namespace — under X11 you may need
  <code>gi.require('GdkX11', '4.0')</code> before reaching for them.
</details>
