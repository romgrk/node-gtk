# API

This is the documentation for the API of node-gtk itself. For documentation on the specific modules (`Gtk`, `Gdk`, etc) refer to their own documentation. Usually https://developer.gnome.org/ is a good source though you'll need to search in `lower_snake_case` as it's a C API.

### Exports

- **[require(ns, [version])](#require)**
- **[prependSearchPath(path)](#prepend-search-path)**
- **[prependLibraryPath(path)](#prepend-library-path)**
- **[listAvailableModules()](#list-available-modules)**
- **[registerClass(klass)](#register-class-klass)**

You can also import a namespace directly under ES modules with the `gi:` scheme —
see [require](#require).

<a id="require" />

#### require(ns, [version]) ⇒ `Object`

Requires a module. Automatically loads dependencies.

**Returns**: `Object` - the loaded module

| Param   | Type     | Default | Description                       |
| ------- | -------- | ------- | --------------------------------- |
| ns      | `string` |         | namespace to load                 |
| version | `string` | `null`  | version to load (null for latest) |

Under ES modules you can also import a namespace directly with the `gi:` scheme,
which calls `require` under the hood. Install the hooks with
`node --import node-gtk/register app.mjs`, then:

```javascript
import Gtk from 'gi:Gtk-4.0'      // default export is the namespace object
import GLib from 'gi:GLib-2.0'    // `gi:Name-Version`, or `gi:Name` for the latest
const { Box, Label } = Gtk        // members are read off the namespace
```

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

<a id="list-available-modules" />

#### listAvailableModules()

Returns a list of available modules

**Returns**: `Promise<ModuleDescription[]>`

<a id="register-class-klass" />

#### registerClass(klass)

Registers a JS class (which must extend a GObject type) as a new GType, so it can
be instantiated and used like a native type.

**This call is optional.** The first time you do `new MySubclass()`, node-gtk
registers the subclass on demand (along with any not-yet-registered ancestors),
so most code never needs to call `registerClass` explicitly. Call it when you
need the GType *before* constructing an instance — e.g. to read it with
`getGType`, reference it by name in a GtkBuilder template, or use it as another
type's property/child type. Calling it on an already-registered class is a no-op.

By default the GType name is the class name; override it with a static
`GTypeName`. Vfunc overrides are matched by the `snake_case` of the method name
(e.g. `getRequestMode` → `get_request_mode`).

| Param | Type     | Description                                          |
| ----- | -------- | ---------------------------------------------------- |
| klass | `Class`  | the class to register (must extend a GObject type)   |

