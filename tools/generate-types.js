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
 *   node tools/generate-types.js Gtk-4.0 [More-X.Y ...] --outdir ./types/generated
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
    case Tag.INT32: case Tag.UINT32: case Tag.INT64: case Tag.UINT64:
    case Tag.FLOAT: case Tag.DOUBLE: case Tag.UNICHAR:
      return 'number' // LIMITATION: int64/uint64 may be bigint at runtime
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
      return '(...args: any[]) => any' // LIMITATION: callback signature not expanded
    case T.OBJECT: case T.INTERFACE: case T.STRUCT: case T.BOXED:
    case T.UNION: case T.ENUM: case T.FLAGS:
      return qualify(ns, safeIdent(name), ctx)
    default:
      return 'any'
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

// Returns { params: string, ret: string }
function signature(callable, ctx, { isConstructor = false, ownerName = null } = {}) {
  const args = each(callable, GI.callable_info_get_n_args, GI.callable_info_get_arg)
  const params = []
  let argIndex = 0

  for (const arg of args) {
    const dir = GI.arg_info_get_direction(arg)
    // LIMITATION: OUT params are dropped here; node-gtk surfaces them via the
    // return value (tupling). A production generator would model that.
    if (dir === GI.Direction.OUT) continue

    const argType = GI.arg_info_get_type(arg)
    let t = resolveType(argType, ctx)
    if (GI.arg_info_may_be_null(arg)) t += ' | null'

    let pname = safeIdent(camelCase(baseName(arg))) || `arg${argIndex}`
    params.push(`${pname}: ${t}`)
    argIndex++
  }

  let ret
  if (isConstructor && ownerName) {
    ret = ownerName
  } else {
    const retType = GI.callable_info_get_return_type(callable)
    ret = resolveType(retType, ctx)
    if (GI.callable_info_may_return_null(callable) && ret !== 'void' && ret !== 'any')
      ret += ' | null'
  }

  return { params: params.join(', '), ret }
}

// ---------------------------------------------------------------------------
// member emitters
// ---------------------------------------------------------------------------

function emitMethods(info, nFn, getFn, ctx, ownerName) {
  const lines = []
  for (const m of each(info, nFn, getFn)) {
    try {
      const flags = GI.function_info_get_flags(m)
      const isMethod = (flags & Flags.IS_METHOD) !== 0 && (flags & Flags.IS_CONSTRUCTOR) === 0
      const isCtor = (flags & Flags.IS_CONSTRUCTOR) !== 0
      const name = memberName(camelCase(baseName(m)))
      const sig = signature(m, ctx, { isConstructor: isCtor, ownerName })
      const dep = isDeprecated(m) ? '/** @deprecated */ ' : ''
      if (isCtor)        lines.push(`  ${dep}static ${name}(${sig.params}): ${sig.ret}`)
      else if (isMethod) lines.push(`  ${dep}${name}(${sig.params}): ${sig.ret}`)
      else               lines.push(`  ${dep}static ${name}(${sig.params}): ${sig.ret}`)
    } catch (e) { /* skip unrepresentable member */ }
  }
  return lines
}

function emitProperties(info, nFn, getFn, ctx) {
  const lines = []
  const writable = []
  for (const p of each(info, nFn, getFn)) {
    try {
      const name = memberName(camelCase(baseName(p)))
      const t = resolveType(GI.property_info_get_type(p), ctx)
      const flags = GI.property_info_get_flags(p)
      // GParamFlags: READABLE=1, WRITABLE=2, CONSTRUCT=4, CONSTRUCT_ONLY=8
      const isWritable = (flags & 2) !== 0
      lines.push(`  ${isWritable ? '' : 'readonly '}${name}: ${t}`)
      if (isWritable) writable.push({ name, t })
    } catch (e) {}
  }
  return { lines, writable }
}

function emitFields(info, nFn, getFn, ctx) {
  const lines = []
  for (const f of each(info, nFn, getFn)) {
    try {
      const name = memberName(camelCase(baseName(f)))
      const t = resolveType(GI.field_info_get_type(f), ctx)
      const flags = GI.field_info_get_flags(f)
      const writable = (flags & FieldFlags.WRITABLE) !== 0
      lines.push(`  ${writable ? '' : 'readonly '}${name}: ${t}`)
    } catch (e) {}
  }
  return lines
}

// signals -> typed on()/once()/off() overloads (node-gtk EventEmitter style)
function emitSignals(info, nFn, getFn, ctx) {
  const sigs = []
  for (const s of each(info, nFn, getFn)) {
    try {
      const rawName = baseName(s)
      const sig = signature(s, ctx, {})
      sigs.push({ rawName, params: sig.params, ret: sig.ret })
    } catch (e) {}
  }
  if (sigs.length === 0) return []

  const lines = []
  for (const verb of ['on', 'once']) {
    for (const s of sigs) {
      // node-gtk drops the emitting instance from the callback args (issue #21)
      lines.push(`  ${verb}(signal: ${JSON.stringify(s.rawName)}, callback: (${s.params}) => ${s.ret}, after?: boolean): this`)
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

  const props = emitProperties(info, GI.object_info_get_n_properties, GI.object_info_get_property, ctx)
  const methods = emitMethods(info, GI.object_info_get_n_methods, GI.object_info_get_method, ctx, name)
  const signals = emitSignals(info, GI.object_info_get_n_signals, GI.object_info_get_signal, ctx)
  const constants = each(info, GI.object_info_get_n_constants, GI.object_info_get_constant)
    .map(c => { try { return `  static readonly ${memberName(baseName(c))}: ${resolveType(GI.constant_info_get_type(c), ctx)}` } catch { return null } })
    .filter(Boolean)

  // constructor property bag: writable props from this class, its ancestors, and
  // its implemented interfaces (e.g. Orientable.orientation), camelCase (#320).
  const ctor = collectConstructProps(info, ctx)
  const ctorProps = ctor.size
    ? `{ ${[...ctor].map(([n, t]) => `${n}?: ${t}`).join(', ')} }`
    : '{}'

  // dedup members by declared identifier (props/methods/constants can collide,
  // e.g. a property `foo` plus a getter method also surfaced as `foo`)
  const seen = new Set()
  const dedup = (lines) => lines.filter(l => {
    const m = l.match(/^\s*(?:static\s+|readonly\s+|\/\*\*[^*]*\*\/\s*)*([A-Za-z_$][\w$]*)\s*[(:]/)
    if (!m) return true
    if (seen.has(m[1])) return false
    seen.add(m[1])
    return true
  })

  const out = []
  if (isDeprecated(info)) out.push('/** @deprecated */')
  const ext = parentRef ? ` extends ${parentRef}` : ''
  out.push(`export class ${name}${ext} {`)
  out.push(`  constructor(properties?: ${ctorProps})`)
  out.push(...dedup(constants))
  out.push(...dedup(props.lines))
  out.push(...dedup(methods))
  out.push(...signals)
  // low-level signal API always present (from BaseClass)
  out.push(`  connect(signal: string, callback: (...args: any[]) => any, after?: boolean): number`)
  out.push(`  disconnect(handlerId: number): void`)
  out.push(`  readonly __gtype__: bigint`)
  out.push(`}`)

  // declaration merge to pull in interface members
  if (ifaces.length)
    out.push(`export interface ${name} extends ${ifaces.join(', ')} {}`)

  return out.join('\n')
}

function emitInterface(info, ctx) {
  const name = safeIdent(baseName(info))
  const prereqs = each(info, GI.interface_info_get_n_prerequisites, GI.interface_info_get_prerequisite)
    .map(p => qualify(baseNamespace(p), safeIdent(baseName(p)), ctx))
    .filter(r => !r.endsWith('.Object') && r !== 'Object') // avoid trivial cycles in prototype

  const props = emitProperties(info, GI.interface_info_get_n_properties, GI.interface_info_get_property, ctx)
  const methods = emitMethods(info, GI.interface_info_get_n_methods, GI.interface_info_get_method, ctx, name)

  const ext = prereqs.length ? ` extends ${prereqs.join(', ')}` : ''
  const seen = new Set()
  const dedup = (lines) => lines.filter(l => {
    const m = l.match(/^\s*(?:static\s+|readonly\s+|\/\*\*[^*]*\*\/\s*)*([A-Za-z_$][\w$]*)\s*[(:]/)
    if (!m) return true
    if (seen.has(m[1])) return false
    seen.add(m[1]); return true
  })
  const out = []
  out.push(`export interface ${name}${ext} {`)
  out.push(...dedup(props.lines))
  // interface methods: strip leading indentation markers that imply static
  out.push(...dedup(methods.filter(l => !l.includes('static '))))
  out.push(`}`)
  return out.join('\n')
}

function emitStruct(info, ctx, kind) {
  const name = safeIdent(baseName(info))
  const nFieldsFn = kind === 'union' ? GI.union_info_get_n_fields : GI.struct_info_get_n_fields
  const getFieldFn = kind === 'union' ? GI.union_info_get_field : GI.struct_info_get_field
  const nMethFn = kind === 'union' ? GI.union_info_get_n_methods : GI.struct_info_get_n_methods
  const getMethFn = kind === 'union' ? GI.union_info_get_method : GI.struct_info_get_method

  const fields = emitFields(info, nFieldsFn, getFieldFn, ctx)
  const methods = emitMethods(info, nMethFn, getMethFn, ctx, name)

  const seen = new Set()
  const dedup = (lines) => lines.filter(l => {
    const m = l.match(/^\s*(?:static\s+|readonly\s+|\/\*\*[^*]*\*\/\s*)*([A-Za-z_$][\w$]*)\s*[(:]/)
    if (!m) return true
    if (seen.has(m[1])) return false
    seen.add(m[1]); return true
  })
  const out = []
  if (isDeprecated(info)) out.push('/** @deprecated */')
  out.push(`export class ${name} {`)
  out.push(`  constructor(fields?: { [key: string]: any })`)
  out.push(...dedup(fields))
  out.push(...dedup(methods))
  out.push(`}`)
  return out.join('\n')
}

function emitEnum(info, ctx) {
  const name = safeIdent(baseName(info))
  const out = []
  if (isDeprecated(info)) out.push('/** @deprecated */')
  out.push(`export enum ${name} {`)
  for (const v of each(info, GI.enum_info_get_n_values, GI.enum_info_get_value)) {
    const vname = safeIdent(baseName(v).toUpperCase())
    const value = GI.value_info_get_value(v)
    out.push(`  ${vname} = ${value},`)
  }
  out.push(`}`)
  return out.join('\n')
}

function emitFunction(info, ctx) {
  const name = safeIdent(camelCase(baseName(info)))
  const sig = signature(info, ctx, {})
  const dep = isDeprecated(info) ? '/** @deprecated */ ' : ''
  return `${dep}export function ${name}(${sig.params}): ${sig.ret}`
}

function emitConstant(info, ctx) {
  const name = safeIdent(baseName(info))
  const t = resolveType(GI.constant_info_get_type(info), ctx)
  return `export const ${name}: ${t}`
}

function emitCallback(info, ctx) {
  const name = safeIdent(baseName(info))
  const sig = signature(info, ctx, {})
  return `export type ${name} = (${sig.params}) => ${sig.ret}`
}

// ---------------------------------------------------------------------------
// namespace driver
// ---------------------------------------------------------------------------

function generateNamespace(ns, version) {
  GI.Repository_require.call(repo, ns, version || null, 0)
  version = version || GI.Repository_get_version.call(repo, ns)

  const ctx = { ns, imports: new Set() }
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
    .map(dep => `import type * as ${dep} from './${dep}-${depVersion[dep] || '*'}'`)
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
  export function startLoop(): void
  export function getGType(value: Function | object | bigint): bigint
  export const System: any`

// Emit `node-gtk.d.ts` next to the generated namespaces. It overloads
// gi.require() so `gi.require('Gtk','4.0')` resolves to the matching namespace.
function writeShim(outdir, nsVersions) {
  const lines = []
  lines.push(`// AUTO-GENERATED by \`node-gtk gen-types\` — module shim for node-gtk.`)
  lines.push(`// Point your tsconfig at this file:`)
  lines.push(`//   "paths": { "node-gtk": ["${path.basename(outdir)}/node-gtk.d.ts"] }`)
  lines.push(``)
  lines.push(`declare module 'node-gtk' {`)
  for (const [ns, version] of nsVersions) {
    lines.push(`  export function require(ns: ${JSON.stringify(ns)}, version: ${JSON.stringify(version)}): typeof import('./${ns}-${version}')`)
  }
  lines.push(`  export function require(ns: string, version?: string): any`)
  lines.push(SHIM_STATIC_API)
  lines.push(`}`)
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
// cli — invoked as `node-gtk gen-types <Namespace-Version> [...] [--outdir DIR]`
// ---------------------------------------------------------------------------

const USAGE = `Usage: node-gtk gen-types <Namespace-Version> [...] [--outdir DIR]

Generates TypeScript declarations for the given GObject-Introspection
namespaces (plus their dependency closure) from the typelibs installed on
THIS machine, and a node-gtk.d.ts module shim.

Examples:
  node-gtk gen-types Gtk-4.0
  node-gtk gen-types Gtk-3.0 Gio-2.0 --outdir ./gtk-types

Then in tsconfig.json:
  { "compilerOptions": {
      "skipLibCheck": true,
      "paths": { "node-gtk": ["./gtk-types/node-gtk.d.ts"] } } }`

function run(argv) {
  let outdir = path.join(process.cwd(), 'gtk-types')
  const roots = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--outdir') { outdir = path.resolve(argv[++i]); continue }
    if (argv[i] === '-h' || argv[i] === '--help') { console.log(USAGE); return }
    roots.push(argv[i])
  }
  if (roots.length === 0) { console.error(USAGE); process.exit(1) }
  generate(roots, outdir)
}

module.exports = { generate, run }

if (require.main === module)
  run(process.argv.slice(2))
