// todo : personal notes:
//  * array<utf8 * > is a string -         "typeName": "utf8",        "size": 8,        "isPointer": true
// what is       "transfer": "NOTHING" ? 
//  what is: "direction": "IN",? 

import { Parsed, ParsedObject, Entity, Type, Interface, Function, Field, Property, Argument } from "./typeGenerationTypes"
import camelCase from 'lodash.camelcase' //TODO: import form lib/index.js ?

export interface RenderOptions {
  target: { [a: string]: Parsed[] }
}

/**
 * Public node-gtk supported libraries TypeScript descriptions generation
 */
export function render(options: RenderOptions) {

  return `// Auto generated file - Do not modify!

type interface_ = any
type class_ = any
type utf8 = string
type gboolean = boolean
type gfloat = number
type gint32 = number
type array=any[] //TODO

${Object.keys(options.target).map(n => `
export namespace ${n} {
${options.target[n].map(renderNode as any).join('\n ')}
}
`).join('\n')}
  `
}

export function renderNode(o: Entity) {
  const prefix = `/** DEBUG:  ${o.infoType} ${o.name} ${o._ns} ${printType(o) + ' - ' + (o.name && o.type && o.type.typeName) + ' - ' + o._ns, o.type && o.type.typeName + ' - ' + o.type && o.type._ns} */\n`
  let s = ''
  if (o.infoType === 'interface') {
    s = renderInterface(o as any)
  }
  if (o.infoType === 'object') {
    s = renderObject(o as any)
  }
  if (o.infoType === 'class') {
    s = renderObject(o as any)
  }
  if (o.infoType === 'struct') {
    s = renderObject(o as any)
  }
  return `${prefix}
${s}
  `
}

function renderObject(o: ParsedObject) {
  return `
  export declare class ${o.name}${o._parent && o._parent.name ? ` extends ${o._parent._ns}.${o._parent.name}` : ''} ${o.interfaces && o.interfaces.length ? ` implements ${o.interfaces.map(i => `${i._ns}.${i.name}`).join(', ')}` : ''} {
    ${(o.properties || []).map(renderProperty).join('\n      ')}
    ${(o.fields || []).map(renderField).join('\n      ')}
    ${(o.methods || []).map(renderMethod).join('\n      ')}
  }
  `.trim()
}

function renderInterface(o: Interface) {
  return `
  export interface ${o.name}${o._parent && o._parent.name ? ` extends ${o._parent._ns}.${o._parent.name}` : ''}  {
    ${(o.properties || []).map(renderProperty).join('\n      ')}
    ${(o.fields || []).map(renderField).join('\n      ')}
    ${(o.methods || []).map(renderMethod).join('\n      ')}
  }
  `.trim()
}

function renderProperty(p: Property) {
  return `${renderMemberModifiers(p)}${camelCase(p.name)}: ${printType(p)}`
}

function renderField(o: Field) {
  if (o.type.callback) {
    return renderMethod(o.type.callback)
  } else {
    return renderProperty(o)
  }
}

function renderArg(o: Argument) {
  return `${o.name}${o.nullable ? '?' : ''}:${printType(o)}`
}

function renderMemberModifiers(o: Entity) {
  return ''
}

function renderMethod(o: Function) {
  const args = `${o.args.map(renderArg).join(', ')}`
  if (o.isConstructor) {
    return `${renderMemberModifiers(o)} constructor(${args})`
  } else {
    return `${renderMemberModifiers(o)}${camelCase(o.name)}(${args}): ${printType({ type: o.return_type } as any)}`
  }
  //TODO: getters and setters
}

function printType(p: Entity) {
  const t = p.type && p.type.typeName || p.typeName
  if (!t) { return 'any' }
  const s = t.substring(0, 1).match(/[A-Z]/) ? `${p.type && p.type._ns || p._ns}.${t}` : `${t}`
  const a = s.split('.') // object.Width, enum.Bar, etc
  const final = (a.length > 1 ? a.slice(1) : a).join('.')
  return typeMap[final] || final || 'any'
}

const typeMap: { [a: string]: string } = {
  'interface': 'interface_',
  'class': 'class_'
}