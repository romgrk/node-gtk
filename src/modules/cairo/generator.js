/*
 * generator.js
 */

const fs = require('fs')
const path = require('path')
const util = require('util')
const nid = require('nid-parser')
const camelCase = require('lodash.camelcase')
const unindent = require('unindent')

util.inspect.defaultOptions = { depth: 6 }

const filename = path.join(__dirname, 'cairo-context.nid')
const content = fs.readFileSync(filename).toString()

const ENUM_TYPE = {
  cairo_bool_t: 'bool',
  cairo_antialias_t: 'int64_t',
  cairo_fill_rule_t: 'int64_t',
  cairo_line_cap_t: 'int64_t',
  cairo_line_join_t: 'int64_t',
  cairo_operator_t: 'int64_t',
  cairo_font_slant_t: 'int64_t',
  cairo_font_weight_t: 'int64_t',
}

const WRAP_TYPE = {
  cairo_path_t: 'Path',
  cairo_text_extents_t: 'TextExtents',
  cairo_font_extents_t: 'FontExtents',
}

const result = nid.parse(content)
const declarations = result.declarations
const functions = declarations.filter(d => d.function).map(d => d.function)

console.assert(declarations.length === functions.length)


// logFn(functions.find(f => f.name === 'cairo_text_extents'))
// logFn(functions.find(f => f.name === 'cairo_font_extents'))

// functions.map(logFn)

console.log(generateSource('CairoContext', functions))


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
    validFunctions.map(fn => fn.source).join('')
    + getSetup(name, validFunctions)
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

  if (typeName === 'double')
    return `auto ${p.name} = Nan::To<double>(info[${n}].As<Number>()).ToChecked();`

  if (typeName === 'const char *')
    return `auto ${p.name} = *Nan::Utf8String (info[${n}].As<String>());`

  if (typeName in ENUM_TYPE)
    return `auto ${p.name} = (${typeName}) Nan::To<${ENUM_TYPE[typeName]}>(info[${n}].As<Number>()).ToChecked();`

  throw new Error('MISSING DECLARATION FOR ' + p.name + ': ' + typeName)
  return '// MISSING DECLARATION FOR ' + p.name + ': ' + typeName
}

function getOutArgumentDeclaration(p, n) {
  const typeName = getTypeName(p.type)

  if (p.type.name === 'double')
    return `double ${p.name} = 0.0;`

  if (p.type.name in WRAP_TYPE)
    return [
      `auto ${p.name} = Nan::NewInstance(`,
      `        Nan::New<Function>(${WRAP_TYPE[p.type.name]}::constructor),`,
      '        0,',
      '        NULL).ToLocalChecked();',
    ].join('\n        ')

  throw new Error('MISSING DECLARATION FOR ' + p.name + ': ' + typeName)
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

function getSetup(name, functions) {
  return unindent(`
    #define SET_METHOD(tpl, name) Nan::SetPrototypeMethod(tpl, #name, name)

    static void AttachMethods(Local<FunctionTemplate> tpl) {
        ${functions.map(fn => `SET_METHOD(tpl, ${getJSName(fn.name)});`).join('\n        ')}
    }

    #undef SET_METHOD
  `)
}


// Helpers

function getInArguments(fn) {
  return fn.parameters.filter((p, i) =>
    !p.attributes.out
    && !(i === 0 && p.type.name === 'cairo_t')
  )
}

function getOutArguments(fn) {
  return fn.parameters.filter((p, i) =>
    p.attributes.out
    && !(i === 0 && p.type.name === 'cairo_t')
  )
}

function getTypeName(type) {
  return type.name + (type.pointer ? ' ' + type.pointer : '')
}

function getJSName(originalName) {
  return camelCase(originalName.replace('cairo_', ''))
}


/*

#define SET_METHOD(target, name) Nan::SetMethod(target, #name, name)

void SetupCairoContext(Local<Function> cairoContext) {
    Local<Object> prototype = Local<Object>::Cast (Nan::Get(cairoContext, UTF8("prototype")).ToLocalChecked());

    SET_METHOD(prototype, setSourceRGBA);
    SET_METHOD(prototype, setSourceRGB);
    SET_METHOD(prototype, setOperator);
    SET_METHOD(prototype, selectFontFace);
    SET_METHOD(prototype, setFontSize);
    SET_METHOD(prototype, setLineWidth);
    SET_METHOD(prototype, moveTo);
    SET_METHOD(prototype, lineTo);
    SET_METHOD(prototype, showText);
    SET_METHOD(prototype, arc);
    SET_METHOD(prototype, fill);
    SET_METHOD(prototype, stroke);
}

#undef SET_METHOD
 */
