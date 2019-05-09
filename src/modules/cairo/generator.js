/*
 * generator.js
 */

const fs = require('fs')
const nid = require('nid-parser')
const camelCase = require('lodash.camelcase')
const unindent = require('./unindent.js')

const ENUM_TYPE = {
  cairo_bool_t: 'bool',
  cairo_antialias_t: 'int64_t',
  cairo_fill_rule_t: 'int64_t',
  cairo_line_cap_t: 'int64_t',
  cairo_line_join_t: 'int64_t',
  cairo_operator_t: 'int64_t',
  cairo_font_slant_t: 'int64_t',
  cairo_font_weight_t: 'int64_t',
  cairo_format_t: 'int64_t',
  cairo_content_t: 'int64_t',
  cairo_pdf_version_t: 'int64_t',
  cairo_pdf_outline_flags_t: 'int64_t',
  cairo_pdf_metadata_t: 'int64_t',
  cairo_ps_level_t: 'int64_t',
  cairo_svg_version_t: 'int64_t',
  cairo_svg_unit_t: 'int64_t',
}

const WRAP_TYPE = {
  cairo_path_t: 'Path',
  cairo_text_extents_t: 'TextExtents',
  cairo_font_extents_t: 'FontExtents',
  cairo_font_options_t: 'FontOptions',
  cairo_matrix_t: 'Matrix',
  cairo_surface_t: 'Surface',
  cairo_rectangle_t: 'Rectangle',
  cairo_rectangle_int_t: 'RectangleInt',
}

module.exports = {
  ENUM_TYPE,
  WRAP_TYPE,
  logFn,
  generateSource,
  getSource,
  getInArgumentSource,
  getOutArgumentDeclaration,
  getFunctionCall,
  getFunctionArgument,
  getReturn,
  getAttachMethods,
  parseFile,
  getInArguments,
  getOutArguments,
  getTypeName,
  getJSName,
}

// Functions

function logFn(fn) {
  let source
  try {
    source = getSource(fn)
    // console.log('##### ' + fn.name + ' #####')
  } catch (e) {
    console.log('##### ' + fn.name + ' #####')
    console.log('Info:', fn)
    console.log(e)
  }
  // console.log('Source: ', source, '\n')
  console.log(source, '\n')
}

function generateSource(name, functions) {
  functions.forEach(fn => {
    try {
      fn.source = getSource(fn)
      // console.log('##### ' + fn.name + ' #####')
    } catch (e) {
      fn.source = undefined
      fn.error = e
    }
  })

  const validFunctions = functions.filter(fn => fn.source)

  const result = (
    validFunctions.map(fn => fn.source).join('\n\n')
    + '\n\n'
    + getAttachMethods(name, validFunctions)
  )

  return result.replace(/^  /gm, '')
}

function getSource(fn) {
  const selfArgument = fn.parameters[0]
  const inArguments = getInArguments(fn)
  const outArguments = getOutArguments(fn)
  const hasResult = getTypeName(fn.type) !== 'void' || outArguments.length > 0

  return unindent(`
    NAN_METHOD(${getJSName(fn.name)}) {
        auto self = info.This();
        auto ${selfArgument.name} = (${getTypeName(selfArgument.type)}) self->GetAlignedPointerFromInternalField (0);
${inArguments.length > 0 ? `
        // in-arguments
        ${inArguments.map(getInArgumentSource).join('\n        ')}
` : ''}${outArguments.length > 0 ? `
        // out-arguments
        ${outArguments.map(getOutArgumentDeclaration).join('\n        ')}
` : ''}
        // function call
        ${getFunctionCall(fn)}
${hasResult ? `
        // return
        ${getReturn(fn, outArguments)}
` : ''}    }
  `)
}


function getInArgumentSource(p, n) {
  const typeName = getTypeName(p.type)
  const baseName = p.type.name.replace('const ', '')

  if (typeName === 'double')
    return `auto ${p.name} = Nan::To<double>(info[${n}].As<Number>()).ToChecked();`

  if (typeName === 'double *' && p.attributes.inout)
    return `double *${p.name}; *${p.name} = Nan::To<double>(info[${n}].As<Number>()).ToChecked();`

  if (typeName === 'int')
    return `auto ${p.name} = Nan::To<int64_t>(info[${n}].As<Number>()).ToChecked();`

  if (typeName === 'unsigned int')
    return `auto ${p.name} = Nan::To<uint64_t>(info[${n}].As<Number>()).ToChecked();`

  if (typeName === 'const char *')
    return `auto ${p.name} = *Nan::Utf8String (info[${n}].As<String>());`

  if (baseName in ENUM_TYPE)
    return `auto ${p.name} = (${typeName}) Nan::To<${ENUM_TYPE[typeName]}>(info[${n}].As<Number>()).ToChecked();`

  if (baseName in WRAP_TYPE)
    return `auto ${p.name} = Nan::ObjectWrap::Unwrap<${WRAP_TYPE[baseName]}>(info[${n}].As<Object>())->_data;`

  throw new Error('MISSING DECLARATION FOR ' + p.name + ': ' + typeName + `(${baseName})`)

  return '// MISSING DECLARATION FOR ' + p.name + ': ' + typeName
}

function getOutArgumentDeclaration(p, n) {
  const typeName = getTypeName(p.type)
  const baseName = p.type.name.replace('const ', '')

  if (p.type.name === 'double')
    return `double ${p.name} = 0.0;`

  if (p.type.name === 'int')
    return `int ${p.name} = 0;`

  if (p.type.pointer === '*' && baseName in ENUM_TYPE)
    return `${typeName}${p.name} = NULL;`

  if (p.type.name in WRAP_TYPE)
    return [
      `auto ${p.name} = Nan::NewInstance(`,
      `        Nan::New<Function>(${WRAP_TYPE[p.type.name]}::constructor),`,
      '        0,',
      '        NULL).ToLocalChecked();',
    ].join('\n        ')

  throw new Error('MISSING DECLARATION FOR ' + p.name + ': ' + typeName + `(${baseName}) ` + JSON.stringify(p))
  return '// MISSING DECLARATION FOR ' + p.name
}

function getFunctionCall(fn) {
  const typeName = getTypeName(fn.type)
  const hasResult = typeName !== 'void'

  const args = fn.parameters.map(getFunctionArgument).join(', ')

  return (hasResult ? typeName + ' result = ' : '') + `${fn.name} (${args});`
}

function getFunctionArgument(p) {
  if (p.attributes.out && p.type.name in WRAP_TYPE)
    return `Nan::ObjectWrap::Unwrap<${WRAP_TYPE[p.type.name]}>(${p.name})->_data`

  if (p.attributes.out)
    return '&' + p.name

  return p.name
}

function getReturn(fn, outArguments) {
  const lines = []
  const typeName = getTypeName(fn.type)

  if (outArguments.length > 0) {
    console.assert(getTypeName(fn.type) === 'void', 'Non-void with out arguments: ' + fn.name)

    if (outArguments.length === 1 && outArguments[0].type.name in WRAP_TYPE) {
      lines.push(`Local<Value> returnValue = ${outArguments[0].name};`)
    }
    else {
      lines.push(`Local<Object> returnValue = Nan::New<Object> ();`)
      outArguments.forEach(p => {
        lines.push(`Nan::Set (returnValue, UTF8 ("${p.name}"), Nan::New (${p.name}));`)
      })
    }
  }
  else if (fn.type.name in WRAP_TYPE) {
    lines.push(`Local<Value> args[] = { Nan::New<External> (result) };`)
    lines.push(`Local<Function> constructor = Nan::New<Function> (${WRAP_TYPE[fn.type.name]}::constructor);`)
    lines.push(`Local<Value> returnValue = Nan::NewInstance(constructor, 1, args).ToLocalChecked();`)
  }
  else if (typeName !== 'void') {
    lines.push(`Local<Value> returnValue = Nan::New (result);`)
  }

  lines.push(`info.GetReturnValue().Set(returnValue);`)

  return lines.join('\n        ')
}

function getAttachMethods(name, functions) {
  return unindent(`
    #define SET_METHOD(tpl, name) Nan::SetPrototypeMethod(tpl, #name, name)

    static void AttachMethods(Local<FunctionTemplate> tpl) {
        ${functions.map(fn => `SET_METHOD(tpl, ${getJSName(fn.name)});`).join('\n        ')}
    }

    #undef SET_METHOD
  `)
}


function parseFile(filepath) {
  const content = fs.readFileSync(filepath).toString()
  return nid.parse(content)
}


// Helpers

function getInArguments(fn, selfType = 'cairo_t') {
  return fn.parameters.filter((p, i) =>
    !p.attributes.out
    && !(i === 0 && p.type.name === selfType && !fn.attributes.static)
  )
}

function getOutArguments(fn, selfType = 'cairo_t') {
  return fn.parameters.filter((p, i) =>
    p.attributes.out
    && !(i === 0 && p.type.name === selfType)
  )
}

function getTypeName(type) {
  return type.name + (type.pointer ? ' ' + type.pointer : '')
}

function getJSName(originalName, prefix = 'cairo_') {
  return camelCase(originalName.replace(prefix, ''))
}
