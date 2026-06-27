# API

This is the documentation for the API of node-gtk itself. For documentation on the specific modules (`Gtk`, `Gdk`, etc) refer to their own documentation. Usually https://developer.gnome.org/ is a good source though you'll need to search in `lower_snake_case` as it's a C API.

### Exports

- **[require(ns, [version])](#require)**
- **[prependSearchPath(path)](#prepend-search-path)**
- **[prependLibraryPath(path)](#prepend-library-path)**
- **[listAvailableModules()](#list-available-modules)**
- **[registerClass(klass)](#register-class-klass)**
- **[flushRegistrations()](#flush-registrations)**

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

#### registerClass(klass) ⇒ `Class`

Registers a JS class (which must extend a GObject type) as a new GType, so it can
be instantiated and used like a native type. Returns the same class, so it can be
assigned or used as a decorator.

If the parent type isn't registered yet, the call is **deferred and accumulated**:
it does not throw, and is retried automatically once the parent — or the namespace
it belongs to — is loaded. This makes registration order-independent (a subclass
may be registered before its superclass) and safe to call before the runtime is
fully initialized. Programmer errors (an invalid `GTypeName`, or a base class that
isn't a GObject type) still throw synchronously.

By default the GType name is the class name; override it with a static
`GTypeName`. Vfunc overrides are matched by the `snake_case` of the method name
(e.g. `getRequestMode` → `get_request_mode`).

**Returns**: `Class` - the class passed in

| Param | Type     | Description                                  |
| ----- | -------- | -------------------------------------------- |
| klass | `Class`  | the class to register (must extend a GObject type) |

<a id="flush-registrations" />

#### flushRegistrations()

Retries any deferred `registerClass` calls (see above). This happens automatically
whenever a namespace is loaded or a class is registered, so calling it manually is
rarely needed — it's an escape hatch for unusual initialization ordering.

