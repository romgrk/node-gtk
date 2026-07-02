# Evaluation: migrating from Nan to N-API (Node-API)

This document records an evaluation (July 2026, against Node 26.4.0) of whether
node-gtk could drop [Nan](https://github.com/nodejs/nan) in favor of
[N-API](https://nodejs.org/api/n-api.html). Short version: **it is feasible** —
the two suspected blockers turned out to be portable — but it is a large
mechanical migration (~15k LOC, 47 files) for a thin gain, so it is not
currently planned. The findings below are kept so the analysis doesn't have to
be redone from scratch if V8/Nan churn ever forces the question.

## What we'd gain, and why it's thin

N-API's headline benefit is ABI stability: one binary per platform across Node
versions, no per-ABI rebuilds. But node-gtk links against
`gobject-introspection` and `cairo`, so it needs per-platform prebuilds
regardless. The win would only be collapsing the `node_abi` dimension of the
prebuild matrix — real, but modest.

Meanwhile the actual recurring pain — V8 API churn (V8 14's `HolderV2`,
`GetPrototypeV2`, internal-field API changes) — is largely absorbed by Nan
today: the Node 26 migration (#474) landed CI-green with modest Nan-level
fixes. Nan is in maintenance mode, however, so this calculus can change.

## Suspected blocker 1: the named-property interceptor — *not a blocker*

`GObjectFallbackPropertyGetter/Setter` (`src/gobject.cc`) is a V8
`NamedPropertyHandlerConfiguration` interceptor (`kNonMasking`), and N-API has
no interceptor API at all (long-standing open request on `node-addon-api`; the
`v8::ObjectTemplate` is deliberately never exposed).

But node-gtk barely depends on it. Per-property accessors are already the
primary mechanism: `lib/bootstrap.js` enumerates every introspected property
(`makeObject` → `addProperty`) and installs plain JS getters/setters that call
`internal.ObjectPropertyGetter/Setter` — ordinary native methods, fully
N-API-compatible. The C++ interceptor is a *fallback*, in practice only load-
bearing for private/non-introspectable GTypes (the #441 family), where
`makeObject()` never runs.

Port strategy: when `GetClassTemplate` builds a class for a type with no GI
info, enumerate its properties with `g_object_class_list_properties()` (plain
GObject API, no typelib needed) and define per-property accessors then. What's
lost is only properties installed *after* `class_init` at runtime — essentially
nonexistent in practice.

Remaining loose end: the cairo `Glyph`/`TextCluster` indexed interceptors
(`Nan::SetIndexedPropertyHandler`) have no per-index equivalent; they would
become real arrays or accessor methods.

## Suspected blocker 2: toggle-ref lifetime machinery — *not a blocker either*

This was believed to be the hard one: `ToggleNotify` (`src/gobject.cc`) flips
the wrapper between weak and strong as the GObject refcount toggles 1↔2,
including *reviving* a weak wrapper when GTK takes ownership, with a two-pass
weak callback whose first pass runs mid-GC. The claim was that N-API finalizers
(post-GC, no resurrection) couldn't express this. Reading Node's implementation
and testing empirically refuted it, claim by claim.

### `napi_ref` *is* the toggle dance

From `node/src/js_native_api_v8.cc` (`Reference::Ref`/`Unref`):

```cpp
uint32_t Reference::Ref() {
  if (persistent_.IsEmpty()) return 0;
  if (++refcount_ == 1 && can_be_weak_) persistent_.ClearWeak();  // = our toggle-up
  ...
uint32_t Reference::Unref() {
  ...
  if (--refcount_ == 0) SetWeak();                                 // = our toggle-down
```

`napi_reference_ref/unref` perform literally the same `ClearWeak`/`SetWeak`
calls `ToggleNotify` makes by hand. The mapping:

| node-gtk today (Nan/V8)                          | N-API equivalent                          |
|--------------------------------------------------|-------------------------------------------|
| toggle-down → `persistent.SetWeak(...)`           | `napi_reference_unref` → 0                 |
| toggle-up → `persistent.ClearWeak()` (revival)    | `napi_reference_ref` → 1                   |
| `collected` flag set in first pass                | `napi_get_reference_value()` returns NULL  |
| toggle-up on a collected wrapper (guard flags)    | `Ref()` on empty persistent: safe no-op, returns 0 |
| fresh wrapper via `WrapperFromGObject`            | unchanged                                  |

Node's `Reference` even carries a comment describing the exact
collected-but-finalizer-pending window node-gtk guards with flags.

### "Can't resurrect" is true but irrelevant

V8 can't resurrect a collected handle either — that's why the `collected` flag
and the build-a-fresh-wrapper path exist. Nothing is lost; the same design
ports unchanged, with `napi_get_reference_value() == NULL` as the (simpler)
collected test.

### The two-pass / mid-GC discipline comes built in

On the stable API, Node's weak callback resets the persistent in the first
pass, then **enqueues** the user finalizer and drains the queue via
`SetImmediate` at event-loop time (`node_api.cc`,
`node_napi_env__::EnqueueFinalizer`). Compare with what node-gtk hand-built
across the #439 crash series:

| hand-rolled after 5 wrapper-lifetime bugs                  | N-API stable path                     |
|------------------------------------------------------------|----------------------------------------|
| first pass: only flip flag + reset handle                   | Node resets persistent, queues finalizer |
| second pass: no JS calls, defer real teardown to `g_idle_add` | finalizer runs at loop time, JS is legal |
| "never call `g_object_*` mid-GC" discipline                 | no addon code runs during GC at all     |

The entire mid-GC-reentrancy bug class (toggle-up revival crash,
dispose-emits-signal-mid-GC, first-pass `g_object_*` crash — see
`doc/signal-handler-gc.md` for the sibling saga) cannot occur, because addon
code never executes inside GC. The `g_idle_add` hop would likely be kept
(finalizers drain on the uv tick; a GLib idle is the safer context under the
node-gtk loop integration), but as belt-and-suspenders, not load-bearing.
If exact two-pass timing were ever needed, `NAPI_EXPERIMENTAL` basic finalizers
+ `node_api_post_finalizer` reproduce it literally.

### Empirical confirmation (Node 26.4.0)

A scratch addon (raw N-API, `napi_create_reference` initial count 0 +
`napi_add_finalizer`) confirmed all four contested behaviors:

- **Revival**: object unreachable from JS, ref weak; `napi_reference_ref`
  before GC; two forced GCs → object survived, finalizer never ran.
- **Collected window**: after GC, `napi_get_reference_value` returns NULL
  immediately, finalizer still pending → the window is detectable.
- **Toggle-up in the window**: `napi_reference_ref` on the collected ref →
  `status=ok, count=0`, no crash.
- **Env teardown**: a finalizer on a *strong, still-live* ref ran at process
  exit.

## The real residue (differences that do matter)

1. **Finalizers run at env teardown.** V8 never ran weak callbacks at exit, so
   node-gtk has no code exercising "drop toggle ref → dispose → signals into
   JS" during interpreter shutdown. Under N-API that path runs for every live
   wrapper at exit and must be guarded (skip JS-touching teardown when the env
   is being destroyed).
2. **Longer collected window** — finalizers run an immediate-tick after GC
   rather than in the second pass. `WrapperFromGObject` already tolerates an
   arbitrarily long window (it survives the `g_idle_add` deferral today).
3. **Boxed uses two internal fields** (`src/boxed.cc`: pointer + `Boxed*`);
   `napi_wrap` provides one slot, so the two pointers get boxed into one
   struct. Touches `modules/system.cc`, `gi.cc`, and the cairo generator
   (`generator.js` emits direct internal-field reads).
4. `napi_reference_ref` fatals if called from a GC-time context — only
   reachable with experimental basic finalizers; a non-issue on the stable
   path since `ToggleNotify` can no longer fire mid-GC.

## Bottom line

Feasible, not planned. The port is ~15k LOC of mostly mechanical conversion
(419 `Nan::New`, 274 `Nan::To`, 232 `ObjectWrap` unwraps, 144 `Persistent`s,
112 internal-field accesses at time of writing), plus re-validating the
lifetime subsystem — which, counterintuitively, would be the *least* risky
part: Node's `Reference` already encodes the state machine node-gtk debugged
into existence, and the deferred-finalizer model removes the mid-GC hazard
class outright. The trigger to revisit is Nan failing to keep up with a V8
API change, not ABI stability.
