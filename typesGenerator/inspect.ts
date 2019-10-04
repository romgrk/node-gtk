import { Type, Parsed, ParsedBase, Function, Vfunc, Constant, Property, Argument, Field, Struct, Enum, Interface, ParsedObject, Entity, Signal } from "./typeGenerationTypes";
import { readdirSync } from 'fs';
import * as nodeGtk from 'node-gtk'

interface GiInfo extends nodeGtk._GIRepository.GiInfo {
  parent: GiInfo | string
  name: GiInfo | string
  infoType: 'function' | 'interface' | 'object'
}

nodeGtk.startLoop();

const GI = nodeGtk._GIRepository as any

function def<T, K extends keyof T>(obj: T, name: K, data: typeof obj[K]) {
  obj[name] = data
}

function name(info: GiInfo) {
  return GI.BaseInfo_get_name.call(info);
}
const namespace = (info: GiInfo) => GI.BaseInfo_get_namespace.call(info);
const getInfoType = (info: GiInfo) => GI.BaseInfo_get_type.call(info);
const type_string = (infotype: number) => GI.info_type_to_string(infotype);
function getTag(type_info: GiInfo) {
  return GI.type_info_get_tag(type_info);
}
const tag_string = (type_tag: number) => GI.type_tag_to_string(type_tag);
const isDeprecated = (info: GiInfo) => GI.BaseInfo_is_deprecated.call(info)

function gtype(info: GiInfo) {
  const type_name = GI.registered_type_info_get_type_name(info);
  if (!type_name)
    return null;
  return GI.registered_type_info_get_g_type(info);
}

function isNoArgsConstructor(info: GiInfo) {
  const flags = GI.function_info_get_flags(info)
  return ((flags & GI.FunctionInfoFlags.IS_CONSTRUCTOR) != 0
    && GI.callable_info_get_n_args(info) == 0)
}

function isConstructor(info: GiInfo) {
  const flags = GI.function_info_get_flags(info)
  return (flags & GI.FunctionInfoFlags.IS_CONSTRUCTOR) != 0
}

function findBoxedConstructor(info: GiInfo): Function | undefined {
  const type = getInfoType(info)
  let result = null
  if (type === GI.InfoType.UNION) {
    const n_methods = GI.union_info_get_n_methods(info);
    for (let i = 0; i < n_methods; i++) {
      const fn_info = GI.union_info_get_method(info, i);
      if (isNoArgsConstructor(fn_info)) {
        result = fn_info;
        break;
      }
    }
    if (!result) {
      for (let i = 0; i < n_methods; i++) {
        const fn_info = GI.union_info_get_method(info, i);
        if (name(fn_info) === 'new') {
          result = fn_info;
          break;
        }
      }
    }
    if (!result) {
      for (let i = 0; i < n_methods; i++) {
        const fn_info = GI.union_info_get_method(info, i);
        if (isConstructor(fn_info)) {
          result = fn_info;
          break;
        }
      }
    }
  }
  else {
    const n_methods = GI.struct_info_get_n_methods(info);
    for (let i = 0; i < n_methods; i++) {
      const fn_info = GI.struct_info_get_method(info, i);
      if (isNoArgsConstructor(fn_info)) {
        result = fn_info;
        break;
      }
    }
    if (!result) {
      for (let i = 0; i < n_methods; i++) {
        const fn_info = GI.struct_info_get_method(info, i);
        if (name(fn_info) === 'new') {
          result = fn_info;
          break;
        }
      }
    }
    if (!result) {
      for (let i = 0; i < n_methods; i++) {
        const fn_info = GI.struct_info_get_method(info, i);
        if (isConstructor(fn_info)) {
          result = fn_info;
          break;
        }
      }
    }
  }
  if (result)
    //@ts-ignore

    return new FunctionInfo(result)
}

//TODO: convert this to a class
function BaseInfo<T extends Parsed = Parsed>(this: T, info: GiInfo) {
  def(this, '_info', info);
  def(this, '_type', getInfoType(info));
  def(this, '_ns', namespace(info));
  def(this, 'gtype', gtype(info));
  this.infoType = GI.info_type_to_string(this._type);
  if (this._type != GI.InfoType.TYPEName) {
    this.name = name(info);
  }
  this.isDeprecated = isDeprecated(info)
}

//TODO: convert this to a class
function TypeInfo(this: Type, info: GiInfo) {
  BaseInfo.call(this, info)
  def(this, '_tag', getTag(info));
  if (this._tag == GI.TypeTag.ARRAY) {
    this.typeName = tag_string(this._tag);
    this.array_type = GI.ArrayType[GI.type_info_get_array_type(info)];
    this.zero_terminated = GI.type_info_is_zero_terminated(info);
    this.fixed_size = GI.type_info_get_array_fixed_size(info);
    this._size = nodeGtk._c.GetTypeSize(info) as number;
    this.isPointer = !!GI.type_info_is_pointer(info)
    //@ts-ignore
    this.elementType = new TypeInfo(GI.type_info_get_param_type(info, 0));
  }
  else if (this._tag == GI.TypeTag.GLIST || this._tag == GI.TypeTag.GSLIST) {
    this.typeName = tag_string(this._tag);
    // const isPointer = GI.type_info_is_pointer(info)
    // if (isPointer)
    this.isPointer = !!GI.type_info_is_pointer(info)
    //@ts-ignore
    this.elementType = new TypeInfo(GI.type_info_get_param_type(info, 0));
  }
  else if (this._tag == GI.TypeTag.GHASH) {
    this.typeName = tag_string(this._tag);
    this.isPointer = !!GI.type_info_is_pointer(info)
    //@ts-ignore
    this.elementType = new TypeInfo(GI.type_info_get_param_type(info, 0));
  }
  else if (this._tag == GI.TypeTag.INTERFACE) {
    const interf = GI.type_info_get_interface(info)
    const infoType = GI.BaseInfo_get_type.call(interf)
    this.typeName = type_string(infoType) + '.' + name(interf)
    this.isPointer = !!GI.type_info_is_pointer(info)
    if (infoType === GI.InfoType.CALLBACK) {
      //@ts-ignore
      this.callback = new FunctionInfo(interf)
    }
  }
  else {
    this.typeName = tag_string(this._tag);
    this._size = nodeGtk._c.GetTypeSize(info);
    this.isPointer = !!GI.type_info_is_pointer(info)
  }
  !this._ns && def(this, '_ns', namespace(info));
}

function ConstantInfo(this: Constant, info: GiInfo) {
  BaseInfo.call(this, info)
  this.value = nodeGtk._c.GetConstantValue(info);
}

function ValueInfo(this: Constant, info: GiInfo) {
  BaseInfo.call(this, info)
  this.value = GI.value_info_get_value(info)
}

function PropInfo(this: Property, info: GiInfo) {
  BaseInfo.call(this, info)
  def(this, '_flags', GI.property_info_get_flags(info));
  def(this, '_typeInfo', GI.property_info_get_type(info));
  def(this, '_tag', getTag(info));
  //@ts-ignore
  this.type = new TypeInfo(this._typeInfo);
  const transfer = GI.property_info_get_ownership_transfer(info);
  this.transfer = GI.Transfer[transfer];
}

function FieldInfo(this: Field, info: GiInfo) {
  BaseInfo.call(this, info)
  def(this, '_flags', GI.field_info_get_flags(info));
  def(this, '_offset', GI.field_info_get_offset(info) as number);
  def(this, '_size', GI.field_info_get_size(info));
  def(this, '_typeInfo', GI.field_info_get_type(info));
  def(this, '_tag', getTag(info));
  //@ts-ignore
  this.type = new TypeInfo(this._typeInfo);
  this.readable = (this._flags & GI.FieldInfoFlags.READABLE) !== 0;
  this.writable = (this._flags & GI.FieldInfoFlags.WRITABLE) !== 0;
}

function StructInfo(this: Struct, info: GiInfo) {
  BaseInfo.call(this, info)
  this.gtype = gtype(info);
  this.size = GI.struct_info_get_size(info);
  this.alignment = GI.struct_info_get_alignment(info);
  this.is_gtype_struct = GI.struct_info_is_gtype_struct(this._info)
  this.is_foreign = GI.struct_info_is_foreign(this._info)
  this.constructor = findBoxedConstructor(info)
  this.methods = array(GI.struct_info_get_n_methods(info))
    .map(i => GI.struct_info_get_method(info, i))
    //@ts-ignore
    .map(m => new FunctionInfo(m))
  this.fields = array(GI.struct_info_get_n_fields(info))
    .map(i => GI.struct_info_get_field(info, i))
    //@ts-ignore
    .map(field => new FieldInfo(field))
}

function UnionInfo(this: Struct, info: GiInfo) {
  BaseInfo.call(this, info)
  this.gtype = gtype(info);
  this.size = GI.union_info_get_size(info);
  this.alignment = GI.union_info_get_alignment(info);
  let is_discriminated = GI.union_info_is_discriminated(info);
  if (is_discriminated) {
    //@ts-ignore
    this.discriminator_type = new TypeInfo(GI.union_info_get_discriminator_type(info));
    this.discriminator_type = GI.union_info_get_discriminator_offset(info);
  }
  this.constructor = findBoxedConstructor(info)
  this.methods = array(GI.union_info_get_n_methods(info))
    .map(i => GI.union_info_get_method(info, i))
    //@ts-ignore
    .map(m => new FunctionInfo(m))
  this.fields = array(GI.union_info_get_n_fields(info))
    .map(i => GI.union_info_get_field(info, i))
    .map((field, i) => ({
      //@ts-ignore
      ...new FieldInfo(field),
      discriminator: nodeGtk._c.GetConstantValue(GI.union_info_get_discriminator(info, i))
    }))
}

function EnumInfo(this: Enum, info: GiInfo) {
  BaseInfo.call(this, info)
  this.values = array(GI.enum_info_get_n_values(info))
    .map(i => GI.enum_info_get_value(info, i))
    //@ts-ignore
    .map(n => ({ name: name(n), ...new ValueInfo(n) }))
  this.methods = array(GI.enum_info_get_n_methods(info))
    .map(i => GI.enum_info_get_method(info, i))
    //@ts-ignore
    .map(n => ({ name: name(n), ...new FunctionInfo(n) }))
}

function InterfaceInfo(this: Interface, info: GiInfo) {
  BaseInfo.call(this, info)
  this.gtype = gtype(info);
  const structInfo = GI.interface_info_get_iface_struct(info)
  if (structInfo !== null)
    //@ts-ignore
    this.iface_struct = new StructInfo(structInfo);
  this.prerequisites = array(GI.interface_info_get_n_prerequisites(info))
    .map(i => GI.interface_info_get_prerequisite(info, i))
    .map(n => getInfo(n)) as any
  this.properties = array(GI.interface_info_get_n_properties(info))
    .map(i => GI.interface_info_get_property(info, i))
    .map(n => getInfo(n)) as any
  this.methods = array(GI.interface_info_get_n_methods(info))
    .map(i => GI.interface_info_get_method(info, i))
    .map(n => getInfo(n)) as any
  this.signals = array(GI.interface_info_get_n_signals(info))
    .map(i => GI.interface_info_get_signal(info, i))
  this.vfuncs = array(GI.interface_info_get_n_vfuncs(info))
    .map(i => GI.interface_info_get_vfunc(info, i))
  this.constants = array(GI.interface_info_get_n_constants(info))
    .map(i => GI.interface_info_get_constant(info, i))
}

function ObjectInfo(this: ParsedObject, info: GiInfo) {
  BaseInfo.call(this, info)
  this.gtype = gtype(info);
  buildParentInfo(this, info);
  this.properties = array(GI.object_info_get_n_properties(info))
    .map(i => GI.object_info_get_property(info, i))
    .map(n => getInfo(n)) as any
  this.constants = array(GI.object_info_get_n_constants(info))
    .map(i => GI.object_info_get_constant(info, i))
    .map(n => getInfo(n)) as any
  this.interfaces = array(GI.object_info_get_n_interfaces(info))
    .map(i => GI.object_info_get_interface(info, i))
    //@ts-ignore
    .map(n => new InterfaceInfo(n))
  this.methods = array(GI.object_info_get_n_methods(info))
    .map(i => GI.object_info_get_method(info, i))
    //@ts-ignore
    .map(n => ({ name: name(n), ...new FunctionInfo(n) }))
  this.signals = array(GI.object_info_get_n_signals(info))
    .map(i => GI.object_info_get_signal(info, i))
    .map(n => ({ name: name(n), ...getInfo(n) })) as any
  this.vfuncs = array(GI.object_info_get_n_vfuncs(info))
    .map(i => GI.object_info_get_vfunc(info, i))
    .map(n => ({ name: name(n), ...n }))
}

function buildParentInfo(self: any, info: GiInfo) {
  if (!info) {
    def(self, '_parent', {})
    return
  }
  const parentInfo = GI.object_info_get_parent(info);
  if (parentInfo) {
    def(self, '_parent', {
      name: name(parentInfo),
      gtype: gtype(parentInfo),
      _ns: namespace(parentInfo)
    });
  }
}

function ArgInfo(this: Argument, info: GiInfo) {
  //@ts-ignore
  BaseInfo.call(this, info)
  def(this, '_typeInfo', GI.arg_info_get_type(info));
  def(this, '_tag', getTag(info));
  this.tag = tag_string(this._tag);
  //@ts-ignore
  this.type = new TypeInfo(this._typeInfo);
  this.name = name(info);
  this.direction = GI.Direction[GI.arg_info_get_direction(info)];
  this.transfer = GI.Transfer[GI.arg_info_get_ownership_transfer(info)];
  const may_be_null = GI.arg_info_may_be_null(info);
  if (may_be_null)
    this.nullable = may_be_null;
  const is_caller_allocates = GI.arg_info_is_caller_allocates(info);
  if (is_caller_allocates)
    this.caller_allocates = true;
  const is_return_value = GI.arg_info_is_return_value(info);
  if (is_return_value)
    this.return_value = true;
  const is_skip = GI.arg_info_is_skip(info);
  if (is_skip)
    this.skip = true;
  const length_pos = GI.type_info_get_array_length(this._typeInfo)
  if (length_pos >= 0)
    this.lengthPos = length_pos
}

function CallableInfo(this: Function, info: GiInfo) {
  //@ts-ignore
  BaseInfo.call(this, info)
  this.args = array(GI.callable_info_get_n_args(info))
    //@ts-ignore
    .map(i => new ArgInfo(GI.callable_info_get_arg(info, i)))
  const transfer = GI.callable_info_get_caller_owns(info);
  this.transfer = GI.Transfer[transfer];
  const return_type = GI.callable_info_get_return_type(info);
  //@ts-ignore
  this.return_type = new TypeInfo(return_type);
  this.return_tag = tag_string(getTag(return_type));
  const mayReturnNull = GI.callable_info_may_return_null(info);
  if (mayReturnNull) this.mayReturnNull = true;
  const skipReturn = GI.callable_info_skip_return(info)
  if (skipReturn) this.skipReturn = true;
  const canThrow = GI.callable_info_can_throw_gerror(info)
  if (canThrow) this.canThrow = true
}

function SignalInfo(this: Signal, info: GiInfo) {
  BaseInfo.call(this, info)
  //@ts-ignore
  CallableInfo.call(this, info);
  def(this, '_flags', GI.signal_info_get_flags(info));
}

function VFuncInfo(this: Vfunc, info: GiInfo) {
  BaseInfo.call(this, info)
  //@ts-ignore
  CallableInfo.call(this, info);
  const invoker = GI.vfunc_info_get_invoker(info);
  if (invoker)
    //@ts-ignore
    this.invoker = new FunctionInfo(invoker);
  const signal = GI.vfunc_info_get_invoker(info);
  if (signal)
    //@ts-ignore
    this.signal = new SignalInfo(signal);
}

function FunctionInfo(this: Function, info: GiInfo): Function | undefined {
  //@ts-ignore
  BaseInfo.call(this, info)
  CallableInfo.call(this, info);
  if (this.infoType === 'callback')
    return
  this.symbol = GI.function_info_get_symbol(info)
  def(this, '_flags', GI.function_info_get_flags(info));
  this.isMethod = (this._flags & GI.FunctionInfoFlags.IS_METHOD) !== 0
  this.isConstructor = (this._flags & GI.FunctionInfoFlags.IS_CONSTRUCTOR) !== 0
  this.isGetter = (this._flags & GI.FunctionInfoFlags.IS_GETTER) !== 0
  this.isSetter = (this._flags & GI.FunctionInfoFlags.IS_SETTER) !== 0
  return this
}

function getInfo(info: GiInfo): Parsed | undefined {
  switch (getInfoType(info)) {
    case GI.InfoType.INVALID:
      return undefined;
    case GI.InfoType.CALLBACK:
    case GI.InfoType.FUNCTION:
      //@ts-ignore
      return new FunctionInfo(info)
    case GI.InfoType.OBJECT:
      //@ts-ignore
      return new ObjectInfo(info)
    case GI.InfoType.ENUM:
    case GI.InfoType.FLAGS:
      //@ts-ignore
      return new EnumInfo(info)
    case GI.InfoType.BOXED:
    case GI.InfoType.STRUCT:
      //@ts-ignore
      return new StructInfo(info)
    case GI.InfoType.UNION:
      //@ts-ignore
      return new UnionInfo(info)
    case GI.InfoType.INTERFACE:
      //@ts-ignore
      return new InterfaceInfo(info)
    case GI.InfoType.CONSTANT:
      //@ts-ignore
      return new ConstantInfo(info)
    case GI.InfoType.FIELD:
      //@ts-ignore
      return new FieldInfo(info)
    case GI.InfoType.PROPERTY:
      //@ts-ignore
      return new PropInfo(info)
    case GI.InfoType.ARG:
      //@ts-ignore
      return new ArgInfo(info)
    case GI.InfoType.TYPE:
      //@ts-ignore
      return new TypeInfo(info)
    case GI.InfoType.VALUE:
      //@ts-ignore
      return new ValueInfo(info)
    case GI.InfoType.SIGNAL:
      //@ts-ignore
      return new SignalInfo(info)
    case GI.InfoType.VFUNC:
      //@ts-ignore
      return new VFuncInfo(info)
    case GI.InfoType.UNRESOLVED:
      return undefined;
  }
  //@ts-ignore
  return new BaseInfo(info)
}

export function getLibs() {
  let paths: string[][] =
    GI.Repository_get_search_path()
      .map((p: string) => readdirSync(p));
  let files = paths.flat()
    .filter(f => f.endsWith('.typelib'))
    .map(f => f.replace(/\.typelib/, ''))
    .map(f => [f].concat(f.split('-')));
  return files;
}

function formatName(info: GiInfo | string) {
  let name = ''
  let current: GiInfo | string = info
  while (current) {
    //@ts-ignore
    name = (current.name || current) + (name ? '.' + name : '')
    //@ts-ignore
    current = current.parent
  }
  return name
}

function formatFunction(fn: Function) {
  return {
    args: (fn.args || []).map(a => ({ name: a.name, type: formatType(a.type), direction: a.direction })),
    returnType: formatType(fn.return_type)
  }
}

function format(i: GiInfo) {
  try {
    const b = {
      typeName: getInfoType(i.infoType as any),//TODO
      typeString: type_string(i.infoType as any),//TODO
      name: formatName(i.name || 'NULL'),
      parent: formatName(i.parent || 'NULL'),//TODO
      ns: namespace(i),
    }
    if (i.infoType === 'function') {
      return {
        ...b,
        //@ts-ignore
        ...formatFunction(i)
      }
    }
    if (i.infoType === 'interface') {
      return {
        ...b,
        //@ts-ignore
        methods: Object.values(i.methods || {}).map(formatFunction),
      }
    }
    if (i.infoType === 'object') {
      return {
        ...b,
        //@ts-ignore
        ...new InterfaceInfo(i),
        //@ts-ignore
        methods: Object.values(i.methods || {}).map(formatFunction)
      }
    }
    else {
      console.warn('Not impl', i.infoType);
      return {
        ...b
      }
    }
  } catch (error) {
    console.error('Err', error);
    return {
      name: 'error'
    }
  }
}

export function extractObjects(ns: string, ver?: string) {
  const library: Parsed[] = []
  const repo = GI.Repository_get_default();
  if (!nodeGtk._isLoaded(ns, ver))
    GI.Repository_require.call(repo, ns, ver, 0);
  const nInfos = GI.Repository_get_n_infos.call(repo, ns);
  for (let i = 0; i < nInfos; i++) {
    const info = GI.Repository_get_info.call(repo, ns, i);
    const baseinfo = getInfo(info);
    baseinfo && library.push({ name: name(info), ...baseinfo })
  }
  return { library }
}

export function formatType(type: Type): string {
  if (type.typeName === 'array')
    return formatType(type.elementType) + '[]'
  if (type.typeName === 'glist' || type.typeName === 'gslist')
    return formatType(type.elementType) + '[]'
  return type.typeName
}

function array<T = number>(n: number, sample?: T): T[] {
  const a: (T | number)[] = []
  for (let i = 0; i < n; i++) {
    a.push(typeof sample === 'undefined' ? i : sample)
  }
  return a as T[]
}