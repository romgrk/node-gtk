/*
 * generate-types.js  —  PROTOTYPE
 *
 * Generates TypeScript declaration files (.d.ts) for GObject-Introspection
 * namespaces, using node-gtk's *own* runtime introspection (the libgirepository
 * API exposed at `require('node-gtk')._GIRepository`).
 *
 * Because we read the same typelib data and apply the same name/shape rules that
 * lib/bootstrap.js applies at runtime, the emitted types match what node-gtk
 * actually produces (camelCase methods, instance dropped from signal callbacks,
 * etc.) — no GJS-vs-node-gtk guesswork.
 *
 * Usage:
 *   node-gtk generate-types Gtk-4.0 [More-X.Y ...] [--outdir DIR]
 *
 * Each requested namespace plus its full transitive dependency closure is
 * emitted as `<Namespace>-<version>.d.ts`.
 *
 * STATUS: proof-of-concept. Known simplifications are marked `// LIMITATION`.
 */

const fs = require('fs')
const path = require('path')
const camelCase = require('lodash.camelcase')

const gi = require('../lib/index.js')
const GI = gi._GIRepository
const T = GI.InfoType
const Tag = GI.TypeTag
const repo = GI.Repository_get_default()

// ---------------------------------------------------------------------------
// thin wrappers over the GI API (mirrors the calling conventions in bootstrap.js)
// ---------------------------------------------------------------------------

const baseName      = (i) => GI.BaseInfo_get_name.call(i)
const baseNamespace = (i) => GI.BaseInfo_get_namespace.call(i)
const baseType      = (i) => GI.BaseInfo_get_type.call(i)
const isDeprecated  = (i) => GI.BaseInfo_is_deprecated.call(i)

const Flags = GI.FunctionInfoFlags
const FieldFlags = GI.FieldInfoFlags

function each(info, nFn, getFn) {
  const out = []
  const n = nFn(info)
  for (let i = 0; i < n; i++) out.push(getFn(info, i))
  return out
}

// ---------------------------------------------------------------------------
// name helpers
// ---------------------------------------------------------------------------

const RESERVED = new Set(['function', 'arguments', 'default', 'in', 'new', 'delete',
  'class', 'this', 'var', 'const', 'let', 'enum', 'export', 'import', 'void',
  'with', 'yield', 'case', 'do', 'switch', 'break', 'continue', 'return', 'for',
  'while', 'if', 'else', 'try', 'catch', 'finally', 'throw', 'typeof',
  'instanceof', 'extends', 'super', 'debugger', 'null', 'true', 'false'])

// For declaration names (classes, enums, functions, type aliases) and for
// parameter identifiers: reserved words are illegal, so suffix them.
function safeIdent(name) {
  if (!name) return '_'
  let n = name.replace(/[^A-Za-z0-9_$]/g, '_')
  if (/^[0-9]/.test(n)) n = '_' + n
  if (RESERVED.has(n)) n = n + '_'
  return n
}

// For class/interface MEMBER names (methods, properties, fields, constants):
// reserved words ARE legal as members (`obj.default`), so don't mangle them;
// only quote names that aren't valid identifiers.
function memberName(name) {
  if (!name) return '"_"'
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)
}

// ---------------------------------------------------------------------------
// documentation (from .gir XML — the compiled typelib does not carry docs)
// ---------------------------------------------------------------------------

// Doc-map keys. Names match GIR `name` attributes, i.e. node-gtk's baseName()
// (snake_case methods, dash-case properties), so the generator and parser agree.
const DocKey = {
  type:     (name)            => `T\0${name}`,
  fn:       (container, name) => `M\0${container}\0${name}`, // method/ctor/static; '' container = top-level
  prop:     (container, name) => `P\0${container}\0${name}`,
  signal:   (container, name) => `S\0${container}\0${name}`,
  field:    (container, name) => `F\0${container}\0${name}`,
  enumVal:  (container, name) => `V\0${container}\0${name}`,
  constant: (container, name) => `C\0${container}\0${name}`,
}

function girSearchDirs() {
  const dirs = []
  const xdg = process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share'
  for (const d of xdg.split(':')) if (d) dirs.push(path.join(d, 'gir-1.0'))
  dirs.push('/usr/share/gir-1.0', '/usr/local/share/gir-1.0')
  return [...new Set(dirs)]
}

function findGir(ns, version) {
  for (const d of girSearchDirs()) {
    const p = path.join(d, `${ns}-${version}.gir`)
    try { if (fs.statSync(p).isFile()) return p } catch (e) {}
  }
  return null
}

function unescapeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, '&') // last, to avoid double-unescaping
}

// Turn GTK-doc markup into something readable inside a JSDoc comment.
function cleanDoc(raw) {
  let t = unescapeXml(raw)
  t = t.replace(/\[(?:func|method|ctor|class|iface|struct|enum|flags|error|const|signal|property|callback|alias|vfunc|id)@([^\]]+)\]/g, '`$1`')
  t = t.replace(/%(TRUE|FALSE|NULL)\b/g, (_, w) => '`' + w.toLowerCase() + '`')
  t = t.replace(/%([A-Za-z_]\w*)/g, '`$1`')
  t = t.replace(/#([A-Za-z_]\w*)/g, '`$1`')
  t = t.replace(/\B@([A-Za-z_]\w*)/g, '`$1`')
  t = t.replace(/\*\//g, '*\\/') // never terminate the enclosing comment
  return t.trim()
}

// Minimal GIR scanner: walks the XML, attributing each <doc>/<doc-deprecated> to
// its enclosing element (always the most-recently-opened element), and parameter
// / return docs to their enclosing callable. Returns null if the .gir is absent
// (docs are best-effort; types still generate without them).
const TYPE_TAGS = new Set(['class', 'interface', 'record', 'union', 'enumeration', 'bitfield'])
const CALLABLE_TAGS = new Set(['method', 'constructor', 'function', 'glib:signal', 'callback', 'virtual-method'])

function loadGirDocs(ns, version) {
  const file = findGir(ns, version)
  if (!file) return null
  let data
  try { data = fs.readFileSync(file, 'utf8') } catch (e) { return null }

  const docs = new Map(), deprecated = new Map()
  const paramDocs = new Map(), returnDocs = new Map()
  const stack = []
  const nearestTypeName = (below) => { for (let j = below; j >= 0; j--) if (TYPE_TAGS.has(stack[j].tag)) return stack[j].name; return '' }
  const nearestCallableKey = () => {
    for (let j = stack.length - 1; j >= 0; j--) {
      const f = stack[j]
      if (CALLABLE_TAGS.has(f.tag)) {
        const c = nearestTypeName(j - 1)
        return f.tag === 'glib:signal' ? DocKey.signal(c, f.name) : DocKey.fn(c, f.name)
      }
    }
    return null
  }

  const handleDoc = (tag, text) => {
    const parent = stack[stack.length - 1]
    if (!parent) return
    if (tag === 'doc-deprecated') {
      const k = symbolKey(parent, stack.length - 1)
      if (k) deprecated.set(k, cleanDoc(text))
      return
    }
    if (parent.tag === 'parameter') { // not instance-parameter (that's `this`)
      const ck = nearestCallableKey()
      if (ck && parent.name) { (paramDocs.get(ck) || paramDocs.set(ck, new Map()).get(ck)).set(parent.name, cleanDoc(text)) }
      return
    }
    if (parent.tag === 'instance-parameter') return
    if (parent.tag === 'return-value') {
      const ck = nearestCallableKey()
      if (ck) returnDocs.set(ck, cleanDoc(text))
      return
    }
    const k = symbolKey(parent, stack.length - 1)
    if (k) docs.set(k, cleanDoc(text))
  }
  const symbolKey = (frame, idx) => {
    const c = nearestTypeName(idx - 1)
    switch (frame.tag) {
      case 'class': case 'interface': case 'record': case 'union':
      case 'enumeration': case 'bitfield': case 'callback': return DocKey.type(frame.name)
      case 'method': case 'constructor': case 'function': return DocKey.fn(c, frame.name)
      case 'glib:signal': return DocKey.signal(c, frame.name)
      case 'property': return DocKey.prop(c, frame.name)
      case 'field': return DocKey.field(c, frame.name)
      case 'member': return DocKey.enumVal(c, frame.name)
      case 'constant': return DocKey.constant(c, frame.name)
      default: return null
    }
  }

  let i = 0, n = data.length
  while (i < n) {
    const lt = data.indexOf('<', i)
    if (lt < 0) break
    i = lt
    if (data.startsWith('<!--', i)) { i = data.indexOf('-->', i) + 3; continue }
    if (data.startsWith('<![CDATA[', i)) { i = data.indexOf(']]>', i) + 3; continue }
    if (data.startsWith('<?', i)) { i = data.indexOf('?>', i) + 2; continue }
    const gt = data.indexOf('>', i)
    if (gt < 0) break
    const raw = data.slice(i + 1, gt)
    i = gt + 1
    if (raw[0] === '/') { stack.pop(); continue }
    const selfClose = raw.endsWith('/')
    const body = selfClose ? raw.slice(0, -1) : raw
    const sp = body.search(/\s/)
    const tag = sp < 0 ? body : body.slice(0, sp)
    if (tag === 'doc' || tag === 'doc-deprecated') {
      const close = '</' + tag + '>'
      const end = data.indexOf(close, i)
      if (end < 0) break
      handleDoc(tag, data.slice(i, end))
      i = end + close.length
      continue
    }
    if (selfClose) continue
    const nm = /\bname="([^"]*)"/.exec(body)
    stack.push({ tag, name: nm ? nm[1] : null })
  }

  return { docs, deprecated, paramDocs, returnDocs }
}

const oneLine = (s) => s.replace(/\s*\n\s*/g, ' ').trim()

// Render a JSDoc block (with trailing newline) for `key`, or '' if no doc.
// `opts.callable` pulls @param/@returns; `opts.deprecated` adds @deprecated.
function docBlock(ctx, key, indent, opts = {}) {
  if (!ctx.doc) return opts.deprecated ? `${indent}/** @deprecated */\n` : ''
  const d = ctx.doc
  const summary = d.docs.get(key)
  const depReason = d.deprecated.get(key)
  const params = opts.callable ? d.paramDocs.get(key) : null
  const ret = opts.callable ? d.returnDocs.get(key) : null
  if (!summary && !depReason && !params && !ret && !opts.deprecated) return ''

  const lines = summary ? summary.split('\n') : []
  const tags = []
  if (params) for (const [pn, pd] of params) if (pd) tags.push(`@param ${camelCase(pn)} ${oneLine(pd)}`)
  if (ret) tags.push(`@returns ${oneLine(ret)}`)
  if (opts.deprecated || depReason) tags.push(`@deprecated${depReason ? ' ' + oneLine(depReason) : ''}`)
  if (lines.length && tags.length) lines.push('')
  lines.push(...tags)

  const out = [`${indent}/**`]
  for (const l of lines) out.push(`${indent} *${l ? ' ' + l : ''}`)
  out.push(`${indent} */`)
  return out.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// type resolution: GITypeInfo -> TypeScript type string
// ---------------------------------------------------------------------------

// `ctx` carries the namespace currently being generated + a set collecting the
// foreign namespaces we reference (so we can emit imports).
function resolveType(typeInfo, ctx) {
  const tag = GI.type_info_get_tag(typeInfo)

  switch (tag) {
    case Tag.VOID:
      return GI.type_info_is_pointer(typeInfo) ? 'any' : 'void'
    case Tag.BOOLEAN:
      return 'boolean'
    case Tag.INT8: case Tag.UINT8: case Tag.INT16: case Tag.UINT16:
    case Tag.INT32: case Tag.UINT32:
    case Tag.FLOAT: case Tag.DOUBLE: case Tag.UNICHAR:
      return 'number'
    case Tag.INT64: case Tag.UINT64:
      // node-gtk marshals 64-bit integers as BigInt for full precision
      // (#323/#149). Params additionally accept number — handled at the param
      // site in signature().
      return 'bigint'
    case Tag.GTYPE:
      return 'bigint' // node-gtk represents GType as BigInt (see getGType)
    case Tag.UTF8: case Tag.FILENAME:
      return 'string'
    case Tag.ARRAY: {
      const elem = GI.type_info_get_param_type(typeInfo, 0)
      const inner = elem ? resolveType(elem, ctx) : 'any'
      return arrayWrap(inner)
    }
    case Tag.GLIST: case Tag.GSLIST: {
      const elem = GI.type_info_get_param_type(typeInfo, 0)
      return arrayWrap(elem ? resolveType(elem, ctx) : 'any')
    }
    case Tag.GHASH: {
      const v = GI.type_info_get_param_type(typeInfo, 1)
      return `Record<string, ${v ? resolveType(v, ctx) : 'any'}>`
    }
    case Tag.ERROR:
      return qualify('GLib', 'Error', ctx)
    case Tag.INTERFACE:
      return resolveInterfaceType(typeInfo, ctx)
    default:
      return 'any'
  }
}

function arrayWrap(inner) {
  return /[^A-Za-z0-9_.$\[\]<>, ]/.test(inner) ? `Array<${inner}>` : `${inner}[]`
}

// A TYPE_TAG_INTERFACE references another registered info (object, struct,
// enum, callback, ...). Resolve to its qualified TS name.
function resolveInterfaceType(typeInfo, ctx) {
  const iface = GI.type_info_get_interface(typeInfo)
  if (!iface) return 'any'
  const itype = baseType(iface)
  const ns = baseNamespace(iface)
  const name = baseName(iface)

  switch (itype) {
    case T.CALLBACK:
      return callbackType(iface, ctx)
    case T.STRUCT:
      // gtype "class struct" (e.g. GObject.ObjectClass) is intentionally not
      // emitted (bootstrap.js skips it); references resolve to `any`.
      if (GI.struct_info_is_gtype_struct(iface)) return 'any'
      return qualify(ns, safeIdent(name), ctx)
    case T.OBJECT: case T.INTERFACE: case T.BOXED:
    case T.UNION: case T.ENUM: case T.FLAGS:
      return qualify(ns, safeIdent(name), ctx)
    default:
      return 'any'
  }
}

// Expand a callback type to a TS function type. node-gtk invokes the JS callback
// with the native args positionally (callback.cc); a TS type with the same/typed
// params is assignable. Guard against deep self-referential callback nesting.
function callbackType(iface, ctx) {
  if ((ctx.cbDepth || 0) > 3) return '(...args: any[]) => any'
  ctx.cbDepth = (ctx.cbDepth || 0) + 1
  try {
    const sig = signature(iface, ctx, {})
    return `(${sig.params}) => ${sig.ret}`
  } catch (e) {
    return '(...args: any[]) => any'
  } finally {
    ctx.cbDepth--
  }
}

// Produce `Name` (same namespace) or `Ns.Name` (foreign), recording the import.
function qualify(ns, name, ctx) {
  if (!ns) return name
  if (ns === ctx.ns) return name
  ctx.imports.add(ns)
  return `${ns}.${name}`
}

// ---------------------------------------------------------------------------
// callables (functions / methods / constructors / signals / vfuncs)
// ---------------------------------------------------------------------------

const DIR = GI.Direction

// Mirrors src/function.cc: classify each arg, hide the ones node-gtk manages
// automatically (array-length args; a callback's user_data/GDestroyNotify), and
// model the return as node-gtk does — a tuple of
//   [ C return (unless void/skip), ...each OUT/INOUT param ]
// where 0 values -> void, 1 -> the bare value, >1 -> a [tuple].
// Returns { params: string, ret: string }.
function signature(callable, ctx, { isConstructor = false, ownerName = null } = {}) {
  const args = each(callable, GI.callable_info_get_n_args, GI.callable_info_get_arg)
  const n = args.length
  const dir = args.map(a => GI.arg_info_get_direction(a))
  const types = args.map(a => GI.arg_info_get_type(a))
  const kind = new Array(n).fill('NORMAL') // NORMAL | ARRAY | CALLBACK | SKIP

  // classification pass (function.cc:157-238)
  for (let i = 0; i < n; i++) {
    if (kind[i] === 'SKIP') continue
    const tag = GI.type_info_get_tag(types[i])

    if (tag === Tag.ARRAY && GI.type_info_get_array_length(types[i]) >= 0) {
      kind[i] = 'ARRAY'
      kind[GI.type_info_get_array_length(types[i])] = 'SKIP' // length arg is hidden
    } else if (tag === Tag.INTERFACE) {
      const iface = GI.type_info_get_interface(types[i])
      if (iface && baseType(iface) === T.CALLBACK) {
        kind[i] = 'CALLBACK'
        const destroyI = GI.arg_info_get_destroy(args[i])
        const closureI = GI.arg_info_get_closure(args[i])
        if (destroyI >= 0 && destroyI < n) kind[destroyI] = 'SKIP' // GDestroyNotify
        if (closureI >= 0 && closureI < n) kind[closureI] = 'SKIP' // user_data
      }
    }
  }

  // JS input params: IN/INOUT, not hidden
  const params = []
  for (let i = 0; i < n; i++) {
    if (kind[i] === 'SKIP' || dir[i] === DIR.OUT) continue
    let t = resolveType(types[i], ctx)
    // 64-bit integers come back as bigint, but the IN side also accepts number.
    const tag = GI.type_info_get_tag(types[i])
    if (tag === Tag.INT64 || tag === Tag.UINT64) t = 'number | bigint'
    if (GI.arg_info_may_be_null(args[i])) t += ' | null'
    params.push(`${safeIdent(camelCase(baseName(args[i]))) || `arg${i}`}: ${t}`)
  }

  if (isConstructor && ownerName)
    return { params: params.join(', '), ret: ownerName }

  // out-values, in node-gtk's order
  const retType = GI.callable_info_get_return_type(callable)
  const retLengthI = GI.type_info_get_array_length(retType)
  const skipReturn =
    GI.type_info_get_tag(retType) === Tag.VOID || GI.callable_info_skip_return(callable)

  const outs = []
  if (!skipReturn) {
    let rt = resolveType(retType, ctx)
    if (GI.callable_info_may_return_null(callable) && rt !== 'any') rt += ' | null'
    outs.push(rt)
  }
  for (let i = 0; i < n; i++) {
    if (i === retLengthI || kind[i] === 'SKIP' || kind[i] === 'CALLBACK') continue
    if (dir[i] === DIR.OUT || dir[i] === DIR.INOUT) {
      let t = resolveType(types[i], ctx)
      if (GI.arg_info_may_be_null(args[i])) t += ' | null'
      outs.push(t)
    }
  }

  const ret = outs.length === 0 ? 'void'
            : outs.length === 1 ? outs[0]
            : `[${outs.join(', ')}]`
  return { params: params.join(', '), ret }
}

// ---------------------------------------------------------------------------
// member emitters
// ---------------------------------------------------------------------------

// Returns a filter that dedups members within one class/interface body while
// PRESERVING method overloads: non-method members (properties/fields/constants)
// dedup by name (first wins); methods dedup by full signature so distinct
// overloads survive; a method name colliding with a non-method is dropped.
function makeMemberDedup() {
  const nonMethod = new Set()
  const methodNames = new Set()
  const methodLines = new Set()
  return (l) => {
    const m = l.match(/^\s*(?:\/\*\*[\s\S]*?\*\/\s*)?(?:static\s+|readonly\s+)*("[^"]*"|[A-Za-z_$][\w$]*)(\s*\()?/)
    if (!m) return true
    const name = m[1], isMethod = !!m[2]
    if (isMethod) {
      if (nonMethod.has(name) || methodLines.has(l)) return false
      methodLines.add(l); methodNames.add(name); return true
    }
    if (nonMethod.has(name) || methodNames.has(name)) return false
    nonMethod.add(name); return true
  }
}

// The signal/event API every GObject inherits from BaseClass (lib/bootstrap.js).
// Kept as [name, signature] so a subclass method that shadows one of these (e.g.
// Gio.SocketConnection.connect) can carry it as an overload and stay assignable.
const SIGNAL_API_INSTANCE = [
  ['connect',    '(signal: string, callback: (...args: any[]) => any, after?: boolean): number'],
  ['disconnect', '(handlerId: number): void'],
  ['on',         '(signal: string, callback: (...args: any[]) => any, after?: boolean): this'],
  ['once',       '(signal: string, callback: (...args: any[]) => any, after?: boolean): this'],
  ['off',        '(signal: string, callback: (...args: any[]) => any): this'],
  ['emit',       '(signal: string, ...args: any[]): any'],
]

// Walk ancestors + implemented interfaces, mapping method name -> set of emitted
// signatures `(params): ret`. Used to reconcile overrides: TS requires a
// subclass member to be assignable to the inherited one, so when a class's own
// method shadows an inherited method with a different signature we re-emit the
// inherited signature(s) as extra overloads. Mirrors what works at runtime,
// where the JS method simply shadows the inherited one.
function collectInheritedMethods(info, ctx) {
  const instance = new Map(), statics = new Map()
  const add = (map, k, s) => { (map.get(k) || map.set(k, new Set()).get(k)).add(s) }

  if (GI.object_info_get_parent(info))
    for (const [n, s] of SIGNAL_API_INSTANCE) add(instance, n, s)

  const addMethods = (klass, ownerName) => {
    for (const m of each(klass, GI.object_info_get_n_methods, GI.object_info_get_method)) {
      try {
        const flags = GI.function_info_get_flags(m)
        const isMethod = (flags & Flags.IS_METHOD) !== 0 && (flags & Flags.IS_CONSTRUCTOR) === 0
        const isCtor = (flags & Flags.IS_CONSTRUCTOR) !== 0
        const sig = signature(m, ctx, { isConstructor: isCtor, ownerName })
        add(isMethod ? instance : statics, memberName(camelCase(baseName(m))), `(${sig.params}): ${sig.ret}`)
      } catch (e) {}
    }
  }
  const addIfaceMethods = (klass) => {
    for (const iface of each(klass, GI.object_info_get_n_interfaces, GI.object_info_get_interface))
      for (const m of each(iface, GI.interface_info_get_n_methods, GI.interface_info_get_method)) {
        try {
          const sig = signature(m, ctx, {})
          add(instance, memberName(camelCase(baseName(m))), `(${sig.params}): ${sig.ret}`)
        } catch (e) {}
      }
  }

  addIfaceMethods(info) // own interfaces (merged into the class type)
  let p = GI.object_info_get_parent(info)
  while (p && baseType(p) === T.OBJECT) {
    // qualify so an inherited constructor's return type (ownerName) is valid
    // across namespaces (e.g. Gtk.NumerableIcon extends Gio.EmblemedIcon).
    addMethods(p, qualify(baseNamespace(p), safeIdent(baseName(p)), ctx))
    addIfaceMethods(p)
    p = GI.object_info_get_parent(p)
  }
  return { instance, statics }
}

// Like collectInheritedMethods but for an interface: gather methods from its
// prerequisites (objects walked as classes, interfaces walked recursively) so
// emitInterface can reconcile members it shadows (e.g. ToolShell.getStyle vs
// Widget.getStyle).
function collectInterfaceInheritedMethods(info, ctx) {
  const instance = new Map()
  const add = (k, s) => { (instance.get(k) || instance.set(k, new Set()).get(k)).add(s) }
  const visited = new Set()

  const addObj = (klass) => {
    let p = klass
    while (p && baseType(p) === T.OBJECT) {
      for (const m of each(p, GI.object_info_get_n_methods, GI.object_info_get_method)) {
        try {
          const flags = GI.function_info_get_flags(m)
          if ((flags & Flags.IS_METHOD) === 0 || (flags & Flags.IS_CONSTRUCTOR) !== 0) continue
          const sig = signature(m, ctx, {})
          add(memberName(camelCase(baseName(m))), `(${sig.params}): ${sig.ret}`)
        } catch (e) {}
      }
      for (const iface of each(p, GI.object_info_get_n_interfaces, GI.object_info_get_interface)) visitIface(iface)
      p = GI.object_info_get_parent(p)
    }
  }
  function visitIface(iface) {
    const key = baseNamespace(iface) + '.' + baseName(iface)
    if (visited.has(key)) return
    visited.add(key)
    for (const m of each(iface, GI.interface_info_get_n_methods, GI.interface_info_get_method)) {
      try { const sig = signature(m, ctx, {}); add(memberName(camelCase(baseName(m))), `(${sig.params}): ${sig.ret}`) } catch (e) {}
    }
    for (const pr of each(iface, GI.interface_info_get_n_prerequisites, GI.interface_info_get_prerequisite)) {
      if (baseType(pr) === T.OBJECT) addObj(pr); else if (baseType(pr) === T.INTERFACE) visitIface(pr)
    }
  }

  for (const pr of each(info, GI.interface_info_get_n_prerequisites, GI.interface_info_get_prerequisite)) {
    if (baseType(pr) === T.OBJECT) addObj(pr); else if (baseType(pr) === T.INTERFACE) visitIface(pr)
  }
  for (const [n, s] of SIGNAL_API_INSTANCE) add(n, s)
  return { instance, statics: new Map() }
}

function emitMethods(info, nFn, getFn, ctx, ownerName, inherited) {
  const lines = []
  for (const m of each(info, nFn, getFn)) {
    try {
      const flags = GI.function_info_get_flags(m)
      const isMethod = (flags & Flags.IS_METHOD) !== 0 && (flags & Flags.IS_CONSTRUCTOR) === 0
      const isCtor = (flags & Flags.IS_CONSTRUCTOR) !== 0
      const isStatic = !isMethod // ctor or static
      const rawName = baseName(m)
      const name = memberName(camelCase(rawName))
      const sig = signature(m, ctx, { isConstructor: isCtor, ownerName })
      const decl = `(${sig.params}): ${sig.ret}`
      const kw = isStatic ? 'static ' : ''

      // override reconciliation: carry differing inherited signatures as overloads
      if (inherited) {
        const inh = (isStatic ? inherited.statics : inherited.instance).get(name)
        if (inh) for (const s of inh) if (s !== decl) lines.push(`  ${kw}${name}${s}`)
      }
      const doc = docBlock(ctx, DocKey.fn(ownerName || '', rawName), '  ', { callable: true, deprecated: isDeprecated(m) })
      lines.push(`${doc}  ${kw}${name}${decl}`)
    } catch (e) { /* skip unrepresentable member */ }
  }
  return lines
}

function emitProperties(info, nFn, getFn, ctx, inherited, containerName) {
  const lines = []
  const writable = []
  for (const p of each(info, nFn, getFn)) {
    try {
      const rawName = baseName(p)
      const name = memberName(camelCase(rawName))
      let t = resolveType(GI.property_info_get_type(p), ctx)
      const flags = GI.property_info_get_flags(p)
      // GParamFlags: READABLE=1, WRITABLE=2, CONSTRUCT=4, CONSTRUCT_ONLY=8
      const isWritable = (flags & 2) !== 0
      // A property whose name shadows an inherited METHOD (e.g. GTK3
      // AppChooserWidget.show-all vs Widget.show_all()) is irreconcilable as a
      // plain field. node-gtk's accessor wins at runtime; intersect with a
      // callable so the declaration stays assignable to the inherited method.
      if (inherited && inherited.instance.has(name)) t = `${t} & ((...args: any[]) => any)`
      const doc = docBlock(ctx, DocKey.prop(containerName || '', rawName), '  ')
      lines.push(`${doc}  ${isWritable ? '' : 'readonly '}${name}: ${t}`)
      if (isWritable) writable.push({ name, t })
    } catch (e) {}
  }
  return { lines, writable }
}

function emitFields(info, nFn, getFn, ctx, containerName) {
  const lines = []
  for (const f of each(info, nFn, getFn)) {
    try {
      const rawName = baseName(f)
      const name = memberName(camelCase(rawName))
      const t = resolveType(GI.field_info_get_type(f), ctx)
      const flags = GI.field_info_get_flags(f)
      const writable = (flags & FieldFlags.WRITABLE) !== 0
      const doc = docBlock(ctx, DocKey.field(containerName || '', rawName), '  ')
      lines.push(`${doc}  ${writable ? '' : 'readonly '}${name}: ${t}`)
    } catch (e) {}
  }
  return lines
}

function collectSignalsFrom(info, nFn, getFn, ctx, seen, out) {
  for (const s of each(info, nFn, getFn)) {
    try {
      const rawName = baseName(s)
      if (seen.has(rawName)) continue
      seen.add(rawName)
      const sig = signature(s, ctx, {})
      out.push({ rawName, params: sig.params, ret: sig.ret, container: baseName(info) })
    } catch (e) {}
  }
}

// own signals only
function collectSignals(info, ctx) {
  const out = []
  collectSignalsFrom(info, GI.object_info_get_n_signals, GI.object_info_get_signal, ctx, new Set(), out)
  return out
}

// all signals reachable: self + ancestors + every implemented interface. Used so
// a class that merges interfaces can declare a single `on` that is a superset of
// (and therefore assignable to) each base's `on`, resolving multiple-inheritance
// conflicts (TS2320).
function collectAllSignals(info, ctx) {
  const seen = new Set(), out = []
  let k = info
  while (k && baseType(k) === T.OBJECT) {
    collectSignalsFrom(k, GI.object_info_get_n_signals, GI.object_info_get_signal, ctx, seen, out)
    for (const iface of each(k, GI.object_info_get_n_interfaces, GI.object_info_get_interface))
      collectSignalsFrom(iface, GI.interface_info_get_n_signals, GI.interface_info_get_signal, ctx, seen, out)
    k = GI.object_info_get_parent(k)
  }
  return out
}

// typed on()/once()/off()/emit() overloads (node-gtk EventEmitter style)
function renderSignals(sigs, ctx) {
  if (sigs.length === 0) return []
  const lines = []
  for (const verb of ['on', 'once']) {
    for (const s of sigs) {
      // node-gtk drops the emitting instance from the callback args (issue #21).
      // Attach the signal's doc to the `on` overload (skip `once` to avoid dupes).
      const doc = verb === 'on' && s.container ? docBlock(ctx, DocKey.signal(s.container, s.rawName), '  ') : ''
      lines.push(`${doc}  ${verb}(signal: ${JSON.stringify(s.rawName)}, callback: (${s.params}) => ${s.ret}, after?: boolean): this`)
    }
    lines.push(`  ${verb}(signal: string, callback: (...args: any[]) => any, after?: boolean): this`)
  }
  lines.push(`  off(signal: string, callback: (...args: any[]) => any): this`)
  lines.push(`  emit(signal: string, ...args: any[]): any`)
  return lines
}

// ---------------------------------------------------------------------------
// top-level declaration emitters
// ---------------------------------------------------------------------------

// Walk the class + ancestors + implemented interfaces, collecting writable
// (settable at construction) properties. Child declarations win over inherited.
function collectConstructProps(info, ctx) {
  const props = new Map()
  const addFrom = (list) => {
    for (const p of list) {
      try {
        if ((GI.property_info_get_flags(p) & 2) === 0) continue // writable only
        const name = memberName(camelCase(baseName(p)))
        if (props.has(name)) continue
        props.set(name, resolveType(GI.property_info_get_type(p), ctx))
      } catch (e) {}
    }
  }
  let cur = info
  while (cur && baseType(cur) === T.OBJECT) {
    addFrom(each(cur, GI.object_info_get_n_properties, GI.object_info_get_property))
    for (const iface of each(cur, GI.object_info_get_n_interfaces, GI.object_info_get_interface))
      addFrom(each(iface, GI.interface_info_get_n_properties, GI.interface_info_get_property))
    cur = GI.object_info_get_parent(cur)
  }
  return props
}

function emitObject(info, ctx) {
  const name = safeIdent(baseName(info))
  const parent = GI.object_info_get_parent(info)
  const parentRef = parent ? qualify(baseNamespace(parent), safeIdent(baseName(parent)), ctx) : null

  // interfaces implemented -> declaration-merged into the class type
  const ifaces = each(info, GI.object_info_get_n_interfaces, GI.object_info_get_interface)
    .map(i => qualify(baseNamespace(i), safeIdent(baseName(i)), ctx))

  const hasIfaces = ifaces.length > 0
  const inherited = collectInheritedMethods(info, ctx)
  const props = emitProperties(info, GI.object_info_get_n_properties, GI.object_info_get_property, ctx, inherited, name)
  const methods = emitMethods(info, GI.object_info_get_n_methods, GI.object_info_get_method, ctx, name, inherited)
  // When the class merges interfaces, declare the signal API in the companion
  // interface (unified across the whole hierarchy) instead of the class body.
  const signals = hasIfaces ? [] : renderSignals(collectSignals(info, ctx), ctx)
  const constants = each(info, GI.object_info_get_n_constants, GI.object_info_get_constant)
    .map(c => { try { return `${docBlock(ctx, DocKey.constant(name, baseName(c)), '  ')}  static readonly ${memberName(baseName(c))}: ${resolveType(GI.constant_info_get_type(c), ctx)}` } catch { return null } })
    .filter(Boolean)

  // constructor property bag: writable props from this class, its ancestors, and
  // its implemented interfaces (e.g. Orientable.orientation), camelCase (#320).
  const ctor = collectConstructProps(info, ctx)
  const ctorProps = ctor.size
    ? `{ ${[...ctor].map(([n, t]) => `${n}?: ${t}`).join(', ')} }`
    : '{}'

  // The synthetic signal API is declared once on root classes; subclasses
  // inherit it (and reconcile via collectInheritedMethods when they shadow it).
  const signalApi = []
  if (!parentRef) {
    for (const [n, s] of SIGNAL_API_INSTANCE) signalApi.push(`  ${n}${s}`)
    signalApi.push(`  readonly __gtype__: bigint`)
  }

  const dedup = makeMemberDedup()
  const body = [...constants, ...props.lines, ...methods, ...signals, ...signalApi].filter(dedup)

  const out = []
  const ext = parentRef ? ` extends ${parentRef}` : ''
  out.push(`${docBlock(ctx, DocKey.type(name), '', { deprecated: isDeprecated(info) })}export class ${name}${ext} {`)
  out.push(`  constructor(properties?: ${ctorProps})`)
  out.push(...body)
  out.push(`}`)

  // Companion interface: declaration-merges the implemented interfaces, and
  // resolves multiple-inheritance conflicts (TS2320) by declaring a unified,
  // assignable-to-all version of any member two bases disagree on:
  //  - `on`/`once`/... unified across the whole signal hierarchy
  //  - real methods present on >1 base with differing signatures, as overloads
  if (hasIfaces) {
    const ownMethodNames = new Set(each(info, GI.object_info_get_n_methods, GI.object_info_get_method)
      .map(m => { try { return memberName(camelCase(baseName(m))) } catch { return null } }))
    const reserved = new Set(SIGNAL_API_INSTANCE.map(([n]) => n))

    const cdedup = makeMemberDedup()
    const cbody = renderSignals(collectAllSignals(info, ctx), ctx).filter(cdedup)
    for (const [mname, sigSet] of inherited.instance) {
      if (sigSet.size < 2 || ownMethodNames.has(mname) || reserved.has(mname)) continue
      for (const s of sigSet) { const line = `  ${mname}${s}`; if (cdedup(line)) cbody.push(line) }
    }

    out.push(`export interface ${name} extends ${ifaces.join(', ')} {${cbody.length ? '\n' + cbody.join('\n') + '\n' : ''}}`)
  }

  return out.join('\n')
}

function emitInterface(info, ctx) {
  const name = safeIdent(baseName(info))
  const prereqs = each(info, GI.interface_info_get_n_prerequisites, GI.interface_info_get_prerequisite)
    .map(p => qualify(baseNamespace(p), safeIdent(baseName(p)), ctx))
    .filter(r => !r.endsWith('.Object') && r !== 'Object') // avoid trivial cycles in prototype

  const inherited = collectInterfaceInheritedMethods(info, ctx)
  const props = emitProperties(info, GI.interface_info_get_n_properties, GI.interface_info_get_property, ctx, inherited, name)
  const methods = emitMethods(info, GI.interface_info_get_n_methods, GI.interface_info_get_method, ctx, name, inherited)

  const ext = prereqs.length ? ` extends ${prereqs.join(', ')}` : ''
  const dedup = makeMemberDedup()
  const instanceLines = methods.filter(l => !l.includes('static '))
  const out = []
  out.push(`${docBlock(ctx, DocKey.type(name), '', { deprecated: isDeprecated(info) })}export interface ${name}${ext} {`)
  out.push(...[...props.lines, ...instanceLines].filter(dedup))
  out.push(`}`)

  // node-gtk exposes an interface as a runtime value carrying its constructor
  // functions (e.g. Gio.File.newForPath) and constants. Emit a same-named const
  // (coexists with the interface type) so the name is usable as a value too. An
  // object-type member may be named `new`/`default` etc., unlike a namespace fn.
  const ndedup = makeMemberDedup()
  const statics = methods
    .filter(l => l.includes('static '))
    .map(l => l.replace(/(^|\n)(\s*)static /, '$1$2')) // drop `static ` keyword (doc block preserved)
  const constants = each(info, GI.interface_info_get_n_constants, GI.interface_info_get_constant)
    .map(c => { try {
      return `  ${memberName(baseName(c))}: ${resolveType(GI.constant_info_get_type(c), ctx)}`
    } catch (e) { return null } })
    .filter(Boolean)
  const valueLines = [...statics, ...constants].filter(ndedup)
  if (valueLines.length)
    out.push(`export const ${name}: {\n${valueLines.join('\n')}\n}`)

  return out.join('\n')
}

function emitStruct(info, ctx, kind) {
  const name = safeIdent(baseName(info))
  const nFieldsFn = kind === 'union' ? GI.union_info_get_n_fields : GI.struct_info_get_n_fields
  const getFieldFn = kind === 'union' ? GI.union_info_get_field : GI.struct_info_get_field
  const nMethFn = kind === 'union' ? GI.union_info_get_n_methods : GI.struct_info_get_n_methods
  const getMethFn = kind === 'union' ? GI.union_info_get_method : GI.struct_info_get_method

  const fields = emitFields(info, nFieldsFn, getFieldFn, ctx, name)
  const methods = emitMethods(info, nMethFn, getMethFn, ctx, name)

  const dedup = makeMemberDedup()
  const out = []
  out.push(`${docBlock(ctx, DocKey.type(name), '', { deprecated: isDeprecated(info) })}export class ${name} {`)
  out.push(`  constructor(fields?: { [key: string]: any })`)
  out.push(...[...fields, ...methods].filter(dedup))
  out.push(`}`)
  return out.join('\n')
}

function emitEnum(info, ctx) {
  const name = safeIdent(baseName(info))
  const out = []
  out.push(`${docBlock(ctx, DocKey.type(name), '', { deprecated: isDeprecated(info) })}export enum ${name} {`)
  for (const v of each(info, GI.enum_info_get_n_values, GI.enum_info_get_value)) {
    const rawV = baseName(v)
    const vname = safeIdent(rawV.toUpperCase())
    const value = GI.value_info_get_value(v)
    out.push(`${docBlock(ctx, DocKey.enumVal(name, rawV), '  ')}  ${vname} = ${value},`)
  }
  out.push(`}`)

  // node-gtk attaches enum methods to the enum object (bootstrap.js makeEnum);
  // surface them via a declaration-merged namespace.
  const methods = each(info, GI.enum_info_get_n_methods, GI.enum_info_get_method)
    .map(m => { try {
      const sig = signature(m, ctx, {})
      return `  export function ${memberName(camelCase(baseName(m)))}(${sig.params}): ${sig.ret}`
    } catch (e) { return null } })
    .filter(Boolean)
  if (methods.length)
    out.push(`export namespace ${name} {\n${methods.join('\n')}\n}`)

  return out.join('\n')
}

function emitFunction(info, ctx) {
  const rawName = baseName(info)
  const name = safeIdent(camelCase(rawName))
  const sig = signature(info, ctx, {})
  const doc = docBlock(ctx, DocKey.fn('', rawName), '', { callable: true, deprecated: isDeprecated(info) })
  return `${doc}export function ${name}(${sig.params}): ${sig.ret}`
}

function emitConstant(info, ctx) {
  const rawName = baseName(info)
  const name = safeIdent(rawName)
  const t = resolveType(GI.constant_info_get_type(info), ctx)
  const doc = docBlock(ctx, DocKey.constant('', rawName), '', { deprecated: isDeprecated(info) })
  return `${doc}export const ${name}: ${t}`
}

function emitCallback(info, ctx) {
  const name = safeIdent(baseName(info))
  const sig = signature(info, ctx, {})
  const doc = docBlock(ctx, DocKey.type(name), '', { deprecated: isDeprecated(info) })
  return `${doc}export type ${name} = (${sig.params}) => ${sig.ret}`
}

// ---------------------------------------------------------------------------
// namespace driver
// ---------------------------------------------------------------------------

function generateNamespace(ns, version) {
  GI.Repository_require.call(repo, ns, version || null, 0)
  version = version || GI.Repository_get_version.call(repo, ns)

  const ctx = { ns, imports: new Set(), doc: DOCS_ENABLED ? loadGirDocs(ns, version) : null }
  const decls = []
  const n = GI.Repository_get_n_infos.call(repo, ns)

  for (let i = 0; i < n; i++) {
    const info = GI.Repository_get_info.call(repo, ns, i)
    try {
      switch (baseType(info)) {
        case T.OBJECT:    decls.push(emitObject(info, ctx)); break
        case T.INTERFACE: decls.push(emitInterface(info, ctx)); break
        case T.STRUCT:
          if (GI.struct_info_is_gtype_struct(info)) break
          decls.push(emitStruct(info, ctx, 'struct')); break
        case T.BOXED:     decls.push(emitStruct(info, ctx, 'struct')); break
        case T.UNION:     decls.push(emitStruct(info, ctx, 'union')); break
        case T.ENUM: case T.FLAGS: decls.push(emitEnum(info, ctx)); break
        case T.FUNCTION:  decls.push(emitFunction(info, ctx)); break
        case T.CONSTANT:  decls.push(emitConstant(info, ctx)); break
        case T.CALLBACK:  decls.push(emitCallback(info, ctx)); break
      }
    } catch (e) {
      decls.push(`// SKIPPED ${baseName(info)}: ${e.message}`)
    }
  }

  const deps = GI.Repository_get_dependencies.call(repo, ns, version) || []
  const depVersion = {}
  for (const d of deps) {
    const [dn, dv] = d.split('-')
    depVersion[dn] = dv
  }

  const header = [
    `// AUTO-GENERATED by tools/generate-types.js — node-gtk TypeScript prototype`,
    `// Namespace: ${ns}-${version}`,
    ``,
  ]
  const imports = [...ctx.imports]
    .filter(dep => dep !== ns)
    // `.js` extension: required under moduleResolution node16/nodenext (and fine
    // for bundler); resolves to the sibling `.d.ts`.
    .map(dep => `import type * as ${dep} from './${dep}-${depVersion[dep] || '*'}.js'`)
  if (imports.length) { header.push(...imports, '') }

  return { version, deps, body: header.join('\n') + decls.join('\n\n') + '\n' }
}

// The hand-written part of the module shim: node-gtk's own static API. The
// `require()` overloads are generated per-namespace and prepended to this.
const SHIM_STATIC_API = `  export function isLoaded(ns: string, version?: string): boolean
  export function prependSearchPath(path: string): void
  export function prependLibraryPath(path: string): void
  export function listAvailableModules(): Promise<{ name: string, version: string }[]>
  export function registerClass(klass: Function): Function
  export function flushRegistrations(): void
  export function startLoop(): void
  export function getGType(value: Function | object | bigint): bigint
  export const System: any`

// Emit `node-gtk.d.ts` next to the generated namespaces. It overloads
// gi.require() so `gi.require('Gtk','4.0')` resolves to the matching namespace.
function writeShim(outdir, nsVersions) {
  const relDir = path.relative(process.cwd(), outdir).split(path.sep).join('/') || '.'
  const lines = []
  lines.push(`// AUTO-GENERATED by \`node-gtk generate-types\` — module shim for node-gtk.`)
  lines.push(`// Point your tsconfig at this file:`)
  lines.push(`//   "paths": { "node-gtk": ["./${relDir}/node-gtk.d.ts"] }`)
  lines.push(``)
  lines.push(`declare module 'node-gtk' {`)
  for (const [ns, version] of nsVersions) {
    lines.push(`  export function require(ns: ${JSON.stringify(ns)}, version: ${JSON.stringify(version)}): typeof import('./${ns}-${version}.js')`)
  }
  lines.push(`  export function require(ns: string, version?: string): any`)
  lines.push(SHIM_STATIC_API)
  lines.push(`}`)

  // Ambient declarations for the `gi:` ESM import scheme, so
  // `import Gtk from 'gi:Gtk-4.0'` is typed as the namespace object (the same
  // type `gi.require('Gtk','4.0')` returns). The versionless `gi:Gtk` alias
  // resolves to the version generated here; the `gi:*` fallback keeps any
  // un-generated namespace as `any` instead of an unresolved-module error.
  lines.push(``)
  for (const [ns, version] of nsVersions) {
    const type = `typeof import('./${ns}-${version}.js')`
    lines.push(`declare module 'gi:${ns}-${version}' { const ns: ${type}; export default ns }`)
    lines.push(`declare module 'gi:${ns}' { const ns: ${type}; export default ns }`)
  }
  lines.push(`declare module 'gi:*' { const ns: any; export default ns }`)

  fs.writeFileSync(path.join(outdir, 'node-gtk.d.ts'), lines.join('\n') + '\n')
}

// Generate the requested namespaces plus their full dependency closure, then the
// module shim. Returns the map of generated namespace -> version.
function generate(roots, outdir) {
  fs.mkdirSync(outdir, { recursive: true })
  const queue = roots.map(r => r.split('-'))
  const nsVersions = new Map() // ns -> resolved version

  while (queue.length) {
    const [ns, version] = queue.shift()
    if (nsVersions.has(ns)) continue

    process.stderr.write(`generating ${ns}-${version || '(latest)'} ...\n`)
    const { version: v, deps, body } = generateNamespace(ns, version)
    nsVersions.set(ns, v)
    fs.writeFileSync(path.join(outdir, `${ns}-${v}.d.ts`), body)

    for (const d of deps) {
      const [dn, dv] = d.split('-')
      if (!nsVersions.has(dn)) queue.push([dn, dv])
    }
  }

  writeShim(outdir, nsVersions)
  process.stderr.write(`\nwrote ${nsVersions.size} namespace(s) + node-gtk.d.ts to ${outdir}\n`)
  return nsVersions
}

// ---------------------------------------------------------------------------
// cli — `node-gtk generate-types <Namespace-Version> [...] [--outdir DIR]`
// ---------------------------------------------------------------------------

// Default output is hidden inside node_modules: it's a generated cache (per
// machine / per installed library versions), so it doesn't belong in the repo.
const DEFAULT_OUTDIR = ['node_modules', '.node-gtk-types']

// Doc comments are pulled from .gir XML; toggled off with --no-docs.
let DOCS_ENABLED = true

const USAGE = `Usage: node-gtk generate-types <Namespace-Version> [...] [options]

Generates TypeScript declarations for the given GObject-Introspection
namespaces (plus their dependency closure) from the typelibs installed on
THIS machine, and a node-gtk.d.ts module shim.

Options:
  --outdir DIR   output directory (default: ./node_modules/.node-gtk-types)
  --no-docs      omit JSDoc comments (smaller output; docs come from .gir XML)

Examples:
  node-gtk generate-types Gtk-4.0
  node-gtk generate-types Gtk-3.0 Gio-2.0 --outdir ./some/dir

Then in tsconfig.json:
  { "compilerOptions": {
      "skipLibCheck": true,
      "paths": { "node-gtk": ["./node_modules/.node-gtk-types/node-gtk.d.ts"] } } }`

function run(argv) {
  let outdir = path.join(process.cwd(), ...DEFAULT_OUTDIR)
  const roots = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--outdir') { outdir = path.resolve(argv[++i]); continue }
    if (argv[i] === '--no-docs') { DOCS_ENABLED = false; continue }
    if (argv[i] === '-h' || argv[i] === '--help') { console.log(USAGE); return }
    roots.push(argv[i])
  }
  if (roots.length === 0) { console.error(USAGE); process.exit(1) }
  generate(roots, outdir)
}

module.exports = { generate, run }

if (require.main === module)
  run(process.argv.slice(2))
