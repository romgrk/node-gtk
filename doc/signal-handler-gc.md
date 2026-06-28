# Signal handlers and garbage collection

This document explains how node-gtk keeps signal-handler functions alive for
exactly as long as they are needed, why the obvious approaches leak or crash,
and the design we settled on. It is the writeup of the investigation behind
[#375](https://github.com/romgrk/node-gtk/pull/375).

## The bug: a reference-loop leak

Connecting a handler that closes over the object it is connected to is the most
natural thing in the world:

```js
const button = new Gtk.Button()
button.on('clicked', () => button.set_label('clicked'))
```

Before the fix, that snippet **leaked the button forever**, even after every JS
reference to it was dropped. The reason is a reference cycle that straddles the
C++ and JS heaps:

```
Closure (C++) ──strong Nan::Persistent──▶ handler fn ──closes over──▶ JS wrapper
   ▲                                                                      │
   └──────────────── GObject ◀── toggle ref ── (qdata) ◀─────────────────┘
        is owned by (g_signal_connect_closure)
```

- The `Closure` stored the handler in a `Nan::Persistent<Function>`, which is a
  **strong GC root**.
- That roots the handler, which closes over the JS wrapper, which is kept alive
  by node-gtk's toggle reference on the `GObject`, which owns the `Closure`.

Nothing outside the cycle references it, but the `Persistent` is itself a root,
so V8 can never collect any of it. `Closure::Invalidated` only fires when the
`GObject` is finalized, which never happens while the cycle pins it. The same
loop also leaks one hop deeper through `Gtk.EventController`s and `Gtk.Gesture`s
(a handler on a controller that closes over the controller or its widget).

Regression tests: `tests/object__closure_refloop_gc.js` and
`tests/object__event_controller_refloop_gc.js` (FinalizationRegistry-based; they
collect `0/N` before the fix and `N/N` after).

## Why this is hard in a Node addon

The cycle crosses the C++/JS boundary, so neither V8's collector nor a C++
`delete` can see the whole thing. There are only three real ways out:

1. **Cross-heap cyclic GC.** PyGObject solves the identical problem because
   CPython's collector does *cyclic* collection across the C/Python boundary:
   extensions implement `tp_traverse`/`tp_clear` and participate in cycle
   detection. **V8 has no equivalent for arbitrary C++ objects** — the only
   mechanism is cppgc (the V8 "unified heap" / Oilpan). This is the route #375
   originally took; see below for why it doesn't work in a node-gyp addon on all
   platforms.
2. **Keep the handler inside the JS heap**, reachable only through the wrapper,
   so V8's ordinary mark-and-sweep collects the wrapper↔handler cycle normally.
   This is the route we took (see "The fix").
3. **Punt to the user** — hold the handler with a strong reference and require
   manual disconnection. This is what NodeGui does: it stores a strong reference
   to the JS emit callback on the C++ side and documents that you must
   `removeEventListener` or you leak. We consider this strictly worse than (2).

### Does node-addon-api help? No.

A reasonable guess is that switching from Nan to **node-addon-api / Node-API**
would help. It does not. Node-API is a stable C ABI for references, object
wrapping and finalizers, but it has **no "trace this reference from C++"
primitive**. Its references are either *strong* (`napi_ref` with a refcount —
a GC root, exactly like `Nan::Persistent`, same leak) or *weak* (does not keep
the callback alive at all). There is no tracing/unified-heap integration. Moving
to node-addon-api would only "avoid cppgc" in the trivial sense of never calling
it — you would still have to break the cycle with approach (2). It is the same
fix wearing a different API.

## What we tried first: cppgc (and why it was reverted)

#375 followed PyGObject's spirit using cppgc: store the handler in a
`v8::TracedReference` (which V8 keeps alive only while it is *traced*) and attach
a cppgc `GarbageCollected` "tracer" object to each wrapper that traces the
watched closures. When the wrapper becomes unreachable the tracer is no longer
traced, the handler is collected, and the cycle breaks. This works on **Linux
and Windows**.

It **crashes on arm64 macOS**, and after an extensive investigation the cause is
not fixable from the addon's side:

- The crash is `EXC_BAD_ACCESS (address=0x8)` inside node's own
  `cppgc::internal::MakeGarbageCollectedTraitInternal::Allocate`, i.e. the very
  first `cppgc::MakeGarbageCollected<…>()` call. lldb backtrace:

  ```
  frame #0  node`cppgc::…::MakeGarbageCollectedTraitInternal::Allocate(AllocationHandle&, size, index) + 52
  frame #1  node_gtk.node`…AllocationDispatcher<ClosureTracer,…>::Invoke(handle, size=88)
  frame #5  node_gtk.node`GNodeJS::AssociateGObject(...)
  ```

  The `cppgc::AllocationHandle&` obtained from
  `isolate->GetCppHeap()->GetAllocationHandle()` is null/garbage on arm64 macOS
  (the fault is a read at offset `0x8` of a ~null pointer). `GetCppHeap()`
  returns a valid pointer; `GetAllocationHandle()` on it does not.

- It is **not** a cppgc ABI/define mismatch. `nm` confirms node's V8 is built
  **uncaged** on every platform (`CagedHeap_count == 0` on both Linux x64 and
  macOS arm64), so the addon (also uncaged) already matches. Defining
  `CPPGC_CAGED_HEAP` / `CPPGC_YOUNG_GENERATION` / `CPPGC_POINTER_COMPRESSION`
  (V8's `enabled_external_cppgc_defines`) only *introduces* a mismatch and was
  reverted.

- It is **not** a missing-symbol problem. The addon imports exactly
  `Isolate::GetCppHeap`, `CppHeap::GetAllocationHandle`,
  `EnsureGCInfoIndex…`, `MakeGarbageCollectedTraitInternal::Allocate` and
  `node::SetCppgcReference`, and the macOS node binary exports all of them
  (correct overloads).

- node's *own* cppgc addon test uses the identical pattern and passes on macOS,
  but only because node builds its test addons **in-tree (statically linked)**
  against V8's object files. A node-gyp addon links against the released node
  binary, and on arm64 macOS that path yields an unusable allocation handle.

In short: cppgc embedder allocation via `MakeGarbageCollected` is effectively
unsupported for node-gyp addons on arm64 macOS today, and there is no addon-side
workaround (allocating our own `cppgc::Heap` would give a valid handle but then
`node::SetCppgcReference` wouldn't trace it, defeating the mechanism). It needs a
fix in node/V8.

## The fix: keep handlers in the JS heap

We break the cycle without cppgc by making the handler reachable **only through
the wrapper's own JS object graph**, so V8's normal collector reclaims the
wrapper↔handler cycle once the wrapper is unreachable.

- Each wrapper stores its connected handlers in a plain JS `Array`, held on the
  wrapper object itself via a private symbol (so it is invisible to user code
  and lives and dies with the wrapper).
- A `Closure` no longer holds a `Nan::Persistent<Function>`. It stores only the
  **index** of its handler in that array — an integer is not a GC root.
- At emit time `Closure::Marshal` takes the instance `GObject` from
  `param_values[0]`, finds its wrapper (`qdata → GObjectWrapper → persistent →
  JS object`), reads `handlers[index]`, and calls it. If the wrapper has already
  been collected (object dropped from JS) the handler is simply not called —
  same semantics as the toggle-ref weak path elsewhere.

Now the only thing keeping a handler alive is the wrapper's array, and the
`handler → wrapper` edge is a normal JS reference. The whole graph is plain JS,
so when the wrapper becomes unreachable V8 collects the array, the handlers and
the wrapper together; node-gtk's existing toggle-ref/idle teardown then drops
the `GObject`. The outcome is exactly what #375 intended (a handler dies with
its object), achieved portably — it works on every platform including arm64
macOS, and needs no cppgc, no `TracedReference`, and no build-config matching.

There is a single C++ lifetime object per wrapper — the existing `GObjectWrapper`
stored in qdata. The handler array lives in JS, so nothing new is introduced on
the C++ side.

### Trade-offs

- **Disconnected handlers linger until the object is collected.** Disconnection
  invalidates the `Closure` (so the handler is never *called* again) but the fix
  intentionally does not reach back into the `GObject` from `Closure::Invalidated`
  to clear the array slot — touching a `GObject` during its own teardown is
  unsafe (see the dispose-during-GC notes in the git history). The handler array
  therefore grows by one entry per `connect` and is only reclaimed when the
  wrapper is. This is bounded by the object's lifetime — the object is still
  fully collectable — so it is not a true leak, only retained memory while the
  object is alive. Heavy connect/disconnect churn on a long-lived object is the
  one case where this is visible; revisit with a wrapper-side weak handle if it
  ever matters.
- The handler lookup at emit time is a few pointer dereferences plus one private
  property read, versus the previous direct `Persistent` deref. Signal emission
  already crosses into JS, so this is negligible.
