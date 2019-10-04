import {_GIRepository}  from 'node-gtk' 

export interface ParsedBase {
  _info: {};
  _type: number;
  _ns: string;
}
export interface Parsed extends ParsedBase {
  name: string;
  infoType: string;
  gtype: number;
  _flags: number;
  is_gtype_struct: boolean;
  is_foreign: boolean;
  constructor: any;
  _tag: number;
  typeName: string;
  tag?: string;
  isDeprecated?: boolean;
}
export interface ParsedObject extends Entity {
}
export interface Parent extends ParsedBase {
  name: string;
}
export interface Entity extends Parsed {
  prerequisites: Prerequisite[];
  properties: Property[];
  methods: Function[];
  type: Type;
  fields: Field[];
  // constructor: TODO;
  interfaces: Interface[];
  signals: Signal[];
  vfuncs: Vfunc[];
  constants: Constant[];
  _typeInfo: _GIRepository.GiInfo;
  transfer: string;
  _parent: Parent;

  return_tag: any;
  return_type: Type;
}
export interface Prerequisite extends Entity {
}
export interface Interface extends Entity {
  iface_struct: InterfaceStruct;
}
export interface InterfaceStruct extends Entity {
}
export interface Property extends Entity {
  writable: boolean; 
}
export interface Type extends Parsed {
  elementType: Type;
  fixed_size: number;
  zero_terminated: boolean;
  array_type: any
  _size: number;
  infoType: string;
  _tag: number;
  type: string;
  isPointer: boolean;
}
export interface Function extends Entity {
  canThrow: boolean;
  skipReturn: boolean;
  mayReturnNull: boolean;
  n_args: 0;
    symbol: string;
  writable: boolean;  
  args: Argument[];
  // TODO: add as a global function too.!

  isMethod: boolean;
  isConstructor: boolean;
  isGetter: boolean;
  isSetter: boolean;
}
export interface Field extends Entity {
  readable: boolean;
  type: FieldType;
  _size: number;
_offset: number
  writable: boolean; //TODO: field.callback
}
export interface FieldType extends Type {
  callback?: Function;
}
export interface Argument extends Entity {
  direction: any;
  lengthPos: any;
  skip: boolean;
  return_value: boolean;
  caller_allocates: boolean;
  nullable: boolean;
}
export interface Signal extends Parsed {
}
export interface Vfunc extends Parsed {
}
export interface Constant extends Parsed {
  value: any;
}
export interface Struct extends Entity {
  discriminator_type: any;
  alignment: any;
  size: any;
}
export interface Enum extends Entity {
  values: any[];
  gtype: any;
  size: any;
}
