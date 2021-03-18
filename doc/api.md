# API

This is the documentation for the API of node-gtk itself. For documentation on the specific modules (`Gtk`, `Gdk`, etc) refer to their own documentation. Usually https://developer.gnome.org/ is a good source though you'll need to search in `lower_snake_case` as it's a C API.

### Exports

- **[require(ns, [version])](#require)**
- **[prependSearchPath(path)](#prepend-search-path)**
- **[prependLibraryPath(path)](#prepend-library-path)**
- **[listAvailableModules()](#list-available-modules)**
- **[registerClass(klass)](#register-class-klass)**

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

<a id="list-available-modules" />

#### listAvailableModules()

Returns a list of available modules

**Returns**: `Promise<ModuleDescription[]>`

<a id="register-class-klass" />

#### registerClass(klass)

Prepends a path to GObject-Introspection library path (for shared libraries)

| Param | Type     |
| ----- | -------- |
| klass  | `object` |

