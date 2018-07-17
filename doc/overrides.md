## Implementing overrides

 - [Functions that create GMainLoop](#functions-that-create-gmainloop)

### Functions that create GMainLoop

Functions that create a GMainLoop should be wrapped as shown in the snippet below.
The function to quit the created loop must be pushed unto the `loopStack`.
Internally, NodeGTK uses this stack to quit all running loops when an exception occurs.

```javascript
const originalMain = Gtk.main
Gtk.main = function main() {
  const loopStack = require('../native.js').GetLoopStack()

  loopStack.push(Gtk.mainQuit)
  originalMain()
  loopStack.pop()
}
```
