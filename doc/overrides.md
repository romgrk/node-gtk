## Implementing overrides

 - [Functions that create GMainLoop](#functions-that-create-gmainloop)
 - [Length arguments](#length-arguments)
 - [Multiple return values](#multiple-return-values)
 - [Boolean result](#boolean-result)

### Functions that create GMainLoop

Functions that create a GMainLoop should be wrapped as shown in the snippet below.
The function to quit the created loop must be pushed unto the `loopStack`.
Internally, NodeGTK uses this stack to quit all running loops when an exception occurs.

```javascript
const internal = require('../native.js')

const originalMain = Gtk.main
Gtk.main = function main() {
  const loopStack = internal.GetLoopStack()
  // Use the same instance of `loopStack` to push and pop
  loopStack.push(Gtk.mainQuit)
  originalMain()
  loopStack.pop()
}
```

### Length arguments

Some functions have return values that can be ignored, usually because they're not relevant in a javascript context.
One such example is described here: https://gitlab.gnome.org/GNOME/gjs/issues/66
In those cases, we're left with a single relevant return value, which should be the JS return value.

`g_key_file_load_from_data (GKeyFile *key_file, const gchar *data, gsize length, GError *error);`

```javascript
const loadFromData = GLib.KeyFile.loadFromData
GLib.KeyFile.loadFromData = function() {
  const [data, length] = loadFromData.apply(this, arguments)
  return data
}
```


### Multiple return values

Methods which return more than one relevant return value.
In those cases, we need to return an object with properties named accordingly.

E.g. `gtk_widget_get_request_size ( GtkWidget *widget, int *width, int *height );`


### Boolean result

Functions as the following one:

```c
gboolean
g_file_get_contents (const gchar *filename,
                     gchar **contents,
                     gsize *length,
                     GError **error);
```

Those return a boolean to allow the following style in C:

```c
GError error;
if (!g_file_get_contents(..., &error)) {
  // Deal with error
}
```

This is irrelevant in JS, because an error would be thrown and the boolean return value is irrelevant.
In those cases, we should just strip the boolean return value, and deal with the rest of the arguments.
