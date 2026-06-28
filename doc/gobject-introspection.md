# The GObject type system

GTK and the libraries around it (GLib, Gio, Adwaita, …) are built on **GObject**,
a type system that adds objects, inheritance, properties, and signals to C. This
guide explains how that system shows up in JavaScript so you can read GTK's C/GI
documentation and translate it to node-gtk on your own. For what a given function
*does*, always refer to the library's own docs — node-gtk only changes *how* you
call it, never *what* it does.

#### Table of contents
  1. [How node-gtk bridges C and JavaScript](#1-how-node-gtk-bridges-c-and-javascript)
  2. [Data types](#2-data-types)
  3. [Structs and unions](#3-structs-and-unions)
  4. [GObjects](#4-gobjects)
  5. [Naming conventions](#5-naming-conventions)
  6. [Function calls](#6-function-calls)
  7. [Common pitfalls](#7-common-pitfalls)

## 1. How node-gtk bridges C and JavaScript

node-gtk doesn't reimplement GTK — it loads the real C libraries and exposes them
to JavaScript at runtime. The bridge is **GObject-Introspection (GI)**: every
GObject-based library ships a machine-readable description of its API (a
`.typelib` file). node-gtk reads that description and builds the matching
JavaScript classes, methods, and constants on the fly. That's why there's no
hand-written wrapper per function, and why the types you'll meet below map so
directly onto C.

Two things are worth keeping in mind as a Node developer:

- **You're calling real C code.** node-gtk converts values across the boundary (a
  JS string ↔ a C `char *`, a JS object ↔ a C struct), but the function that runs
  is the library's own. A few C concepts therefore surface in the API — most
  visibly *out-arguments* (see [§6](#6-function-calls)) — and calling a function
  the wrong way can **crash the process** instead of throwing a catchable error
  (see [§7](#7-common-pitfalls)).
- **Memory is managed for you.** GObject reference-counts its objects; node-gtk
  ties that to V8's garbage collector. You create things with `new` (or a
  creation function) and simply stop referencing them — there is nothing to free.

Everything lives under a **namespace** — the object you import (`Gtk`, `Gio`,
`GLib`, `Adw`). Within one you'll meet four kinds of types, covered next.

## 2. Data types

The GLib Object System maps each kind of type to JavaScript in its own way:

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

#### Numbers and BigInt

Most integers and all floats are plain JavaScript `number`s. The exception is
**64-bit** integers (`gint64`/`guint64`): to preserve full precision they cross
the boundary as **`BigInt`**, so some APIs hand you `10n` rather than `10`. On the
way *in*, a parameter that expects a 64-bit integer accepts either form.

#### Enums and flags

An *enum* is a fixed set of named values; a *flags* type is an enum whose values
are powers of two, meant to be combined into a bitmask. Combine and test them
with JavaScript's bitwise operators, exactly as you would in C:

```javascript
// combine with `|`
const flags = Gio.ApplicationFlags.HANDLES_OPEN | Gio.ApplicationFlags.HANDLES_COMMAND_LINE

// test with `&`
if (flags & Gio.ApplicationFlags.HANDLES_OPEN) { /* … */ }
```

## 3. Structs and unions

Structs and unions are *boxed* types — simple bags of data that may also carry a
few methods. Unlike GObjects they have no inheritance; think of them as plain
records.

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

#### Properties

Besides methods, a GObject exposes **properties** — named, type-checked values
such as a label's text or a window's title. You've already set them at
construction (the object passed to `new`); you can also read and write them
afterwards, in **lowerCamelCase**:

```javascript
const label = new Gtk.Label({ label: 'Hello' })  // set at construction
label.label = 'Goodbye'                           // write
console.log(label.label)                          // read
```

Properties are *observable*: a GObject emits a `notify::<property>` signal
whenever one changes, so you can react to it like any other signal (see below):

```javascript
label.on('notify::label', () => console.log('label is now', label.label))
```

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
registerClass(CustomWidget)
```

> **Register before you instantiate.** `new CustomWidget()` only works *after*
> `registerClass(CustomWidget)`. Instantiating an unregistered subclass falls
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
```

node-gtk registers new GObject subclasses with the type system automatically,
but you can also use `import { registerClass } from 'node-gtk'` to register your
class immediately.

## 5. Naming conventions

node-gtk normalizes names from the C/GIR style to JavaScript conventions. The
guiding rule: a C name like `gtk_widget_set_visible` drops the namespace prefix
and is camelCased into a method, `widget.setVisible(true)`.

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

#### Nullable arguments

C has no optional arguments: where a parameter accepts "nothing", pass `null`
explicitly rather than omitting it. This is why so many calls end in a literal
`null` — for example the cancellable argument that runs through Gio:

```javascript
const cursor = Gdk.Cursor.newFromName('pointer', null) // the fallback arg is required
```

#### Errors

A C function whose last parameter is a `GError` reports failure by **throwing** a
JavaScript exception — the error never appears in the returned values, so handle
it with `try`/`catch`:

```javascript
try {
  const [ok, contents] = GLib.fileGetContents('/path/to/config')
  // ...use contents...
} catch (err) {
  console.error('could not read the file:', err.message)  // thrown on failure
}
```

## 7. Common pitfalls

Because the bindings give you direct access to C functions, misusing a library
can crash the process rather than raise a catchable error. A few frequent
mistakes:

<details>
  <summary><b>Using widgets before GTK is initialized</b></summary>
  GTK must be initialized before you create widgets. <code>Gtk.Application</code>
  / <code>Adw.Application</code> do this for you — so build your UI inside the
  <code>activate</code> handler, not at module top level. Without an application,
  call <code>Gtk.init()</code> first.
</details>

<details>
  <summary><b>Instantiating a subclass before registering it</b></summary>
  Call <code>registerClass(MyClass)</code> before <code>new MyClass()</code>;
  otherwise construction falls back to the abstract base type and aborts the
  process. See <a href="#4-gobjects">§4 → Inheritance</a>.
</details>

<details>
  <summary><b>Omitting a required argument</b></summary>
  C functions have no optional parameters. Pass every argument the signature
  lists — including a literal <code>null</code> for things like a cancellable or
  a fallback value. See <a href="#6-function-calls">§6 → Nullable arguments</a>.
</details>

<details>
  <summary><b>Getting a display causes a segfault (X11)</b></summary>
  Backend-specific APIs live in their own namespace — under X11 you may need
  <code>import GdkX11 from 'gi:GdkX11-4.0'</code> before reaching for them.
</details>
