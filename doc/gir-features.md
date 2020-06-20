
## Features that are supported

There are still less used features that are not supported, but everything you should need to start building
a working Gtk application is supported.

- [x] primitive data types (int, char, …)
- [x] complex data types (arrays, GArray, GList, GHashTable, …)
- [x] GObjects
- [x] Interfaces: methods on GObjects
- [ ] Interfaces: raw C struct conversion to JS
- [x] Signals (`.connect('signal', cb)` or `.on('signal', cb)`)
- [x] Boxed (struct and union) (opaque, with `new`)
- [x] Boxed (struct and union) (opaque, without `new`)
- [x] Boxed (struct and union) (allocation with size)
- [x] Error handling
- [x] Callback arguments
- [x] Function call: IN, OUT & INOUT arguments
- [x] Properties (on GObjects)
- [x] Fields (on Boxeds)
- [x] Event loop (main)
- [ ] Additional event loops (e.g. `g_timeout_add_seconds`)
- [ ] GParamSpec
- [x] Javascript inheritance of C classes
- [x] Memory management

