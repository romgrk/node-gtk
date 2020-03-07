/*
 * generator.js
 */

const fs = require('fs')
const path = require('path')
const nid = require('nid-parser')
const camelCase = require('lodash.camelcase')
const removeTrailingSpaces = require('remove-trailing-spaces')
const { indent, unindent } = require('./indent.js')

const CAST_TYPE = {
  cairo_bool_t: 'bool',
  'unsigned long': 'double',
  'long unsigned': 'double',
}

const ENUM_TYPE = {
  cairo_bool_t: 'bool',
  cairo_antialias_t: 'int64_t',
  cairo_fill_rule_t: 'int64_t',
  cairo_line_cap_t: 'int64_t',
  cairo_line_join_t: 'int64_t',
  cairo_operator_t: 'int64_t',
  cairo_extend_t: 'int64_t',
  cairo_filter_t: 'int64_t',
  cairo_font_slant_t: 'int64_t',
  cairo_font_weight_t: 'int64_t',
  cairo_font_type_t: 'int64_t',
  cairo_format_t: 'int64_t',
  cairo_hint_metrics_t: 'int64_t',
  cairo_hint_style_t: 'int64_t',
  cairo_content_t: 'int64_t',
  cairo_pdf_version_t: 'int64_t',
  cairo_pdf_outline_flags_t: 'int64_t',
  cairo_pdf_metadata_t: 'int64_t',
  cairo_ps_level_t: 'int64_t',
  cairo_region_overlap_t: 'int64_t',
  cairo_subpixel_order_t: 'int64_t',
  cairo_svg_version_t: 'int64_t',
  cairo_svg_unit_t: 'int64_t',
  cairo_text_cluster_flags_t: 'int64_t',
}

const WRAP_TYPE = {
  cairo_path_t: 'Path',
  cairo_pattern_t: 'Pattern',
  cairo_text_extents_t: 'TextExtents',
  cairo_font_extents_t: 'FontExtents',
  cairo_font_face_t: 'FontFace',
  cairo_font_options_t: 'FontOptions',
  cairo_glyph_t: 'Glyph',
  cairo_matrix_t: 'Matrix',
  cairo_region_t: 'Region',
  cairo_rectangle_t: 'Rectangle',
  cairo_rectangle_int_t: 'RectangleInt',
  cairo_scaled_font_t: 'ScaledFont',
  cairo_surface_t: 'Surface',
  cairo_text_cluster_t: 'TextCluster',
}

const EXTERNAL_TYPES = new Set([
  'FT_Face',
  'FcPattern',
  'LOGFONTW',
  'HFONT',
  'CGFontRef',
  'ATSUFontID'
])

const RESTRICTED = new Set(['union', 'xor'])

module.exports = {
  CAST_TYPE,
  ENUM_TYPE,
  WRAP_TYPE,
  RESTRICTED,
  logFn,
  getSource,
  generateClassMethodSource,
  generateSource,
  generateClassVariables,
  generateTemplateMethods,
  generateInitializeMethod,
  generateNewMethod,
  getInArgumentSource,
  getOutArgumentDeclaration,
  getFunctionCall,
  getFunctionArgument,
  getReturn,
  getAttachMethods,
  parseFile,
  getInArguments,
  getOutArguments,
  getInOutArguments,
  getTypeName,
  getJSName,
  addVersionGuard,
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

function getSource(fn) {
  const selfArgument = fn.parameters[0]
  const inArguments = getInArguments(fn)
  const outArguments = getOutArguments(fn)
  const inoutArguments = getInOutArguments(fn)
  const outAndInoutArguments = outArguments.concat(inoutArguments)
  const hasResult = getTypeName(fn.type) !== 'void' || outAndInoutArguments.length > 0

  return unindent(`
    ${fn.attributes.version ? (() => {
      const [major, minor, micro] = fn.attributes.version.split('.')
      return '#if ' + [
        (major ? 'CAIRO_VERSION_MAJOR >= ' + major : undefined),
        (minor ? 'CAIRO_VERSION_MINOR >= ' + minor : undefined),
        (micro ? 'CAIRO_VERSION_MICRO >= ' + micro : undefined),
      ].filter(Boolean).join(' && ')
    })() : '' }
    NAN_METHOD(${getJSName(fn.name)}) {
        auto self = info.This();
        auto ${selfArgument.name} = (${getTypeName(selfArgument.type)}) self->GetAlignedPointerFromInternalField (0);
${inArguments.length > 0 ? `
        // in-arguments
        ${inArguments.map(getInArgumentSource).join('\n        ')}
` : ''}${inoutArguments.length > 0 ? `
        // in-out-arguments
        ${inoutArguments.map(getInArgumentSource).join('\n        ')}
` : ''}${outArguments.length > 0 ? `
        // out-arguments
        ${outArguments.map(getOutArgumentDeclaration).join('\n        ')}
` : ''}
        // function call
        ${getFunctionCall(fn)}
${hasResult ? `
        // return
        ${getReturn(fn, outAndInoutArguments)}
` : ''}    }
    ${fn.attributes.version ? '#endif' : '' }
  `)
}

function generateClassMethodSource(fn, options) {
  const selfArgument = fn.attributes.static !== true ? fn.parameters[0] : undefined
  const inArguments  = getInArguments(fn, options.type)
  const outArguments = getOutArguments(fn, options.type)
  const inoutArguments = getInOutArguments(fn, options.type)
  const outAndInoutArguments = outArguments.concat(inoutArguments)
  const hasResult = getTypeName(fn.type) !== 'void' || outAndInoutArguments.length > 0
  const versionGuard = getVersionGuard(fn)

  const source = `
    ${versionGuard ? versionGuard[0] : ''}${fn.attributes.ifdef ?  `#ifdef ${fn.attributes.ifdef}` : '' }
    NAN_METHOD(${options.name}::${getJSName(fn.name, options.prefix)}) {${selfArgument ? `
      auto self = info.This();
      auto ${selfArgument.name} = Nan::ObjectWrap::Unwrap<${options.name}>(self)->_data;
` : ''}${inArguments.length > 0 ? `
      // in-arguments
      ${inArguments.map(getInArgumentSource).join('\n      ')}
` : ''}${inoutArguments.length > 0 ? `
      // in-out-arguments
      ${inoutArguments.map(getInArgumentSource).join('\n      ')}
` : ''}${outArguments.length > 0 ? `
      // out-arguments
      ${outArguments.map(getOutArgumentDeclaration).join('\n      ')}
` : ''}
      // function call
      ${getFunctionCall(fn)}
${hasResult ? `
      // return
      ${getReturn(fn, outAndInoutArguments)}
` : ''}    }${fn.attributes.ifdef ?  `
    #endif // ${fn.attributes.ifdef}` : '' }
    ${versionGuard ? versionGuard[1] : ''}`

  return source.replace(/^[\n ]*\n(?= +\S)/, '').replace(/\s+$/, '')
}

function generateSource(base, namespaces) {
  const classVariables    = namespaces.map(generateClassVariables)
  const templateMethods = namespaces.map(ns => generateTemplateMethods(ns, namespaces))
  const initializeMethod = generateInitializeMethod(base, namespaces)
  const newMethods = namespaces.map(generateNewMethod)
  const methods =
    namespaces.map(ns => ns.functions.map(fn => fn.source).join('\n\n').trimStart())
      .filter(Boolean).join('\n    ').trimStart()

  return removeTrailingSpaces(unindent(`

    /* autogenerated by ${path.basename(base.filename)} */

    #include "../../debug.h"
    #include "../../gi.h"
    #include "../../util.h"
    ${base.dependencies.map(d => `#include "${d}"`).join('\n    ')}

    using namespace v8;


    namespace GNodeJS {

    namespace Cairo {


    ${classVariables.join('\n    ')}


    /*
     * Initialize
     */

    ${base.name}::${base.name}(${base.type}* data) : ObjectWrap() {
      _data = data;
    }

    /*
     * Destroy
     */

    ${base.name}::~${base.name}() {
      if (_data != NULL) {
        ${base.destroy === 'delete' ?
          'delete _data' :
          `${base.destroy} (_data)` };
      }
    }


    /*
     * Template methods
     */

    ${templateMethods.join('\n    ')}


    /*
     * Initialize method
     */

    ${initializeMethod}


    /*
     * Instance constructors
     */

    ${newMethods.join('\n    ')}


    /*
     * Methods
     */

    ${methods}



    }; // Cairo

    }; // GNodeJS
  `))
}

function generateClassVariables(options) {
  return `
    Nan::Persistent<FunctionTemplate> ${options.name}::constructorTemplate;
    Nan::Persistent<Function>         ${options.name}::constructor;
  `
}

function generateTemplateMethods(options, namespaces) {

  const base = namespaces.find(ns => ns.isBase)

  const staticMethods = options.functions.filter(fn => fn.attributes.static)
  const methods = options.functions.filter(fn => fn.attributes.static !== true)

  return `
    Local<FunctionTemplate> ${options.name}::GetTemplate() {
      if (constructorTemplate.IsEmpty())
        ${base.name}::SetupTemplate();
      return Nan::New<FunctionTemplate> (constructorTemplate);
    }

    Local<Function> ${options.name}::GetConstructor() {
      if (constructor.IsEmpty())
        ${base.name}::SetupTemplate();
      return Nan::New<Function> (constructor);
    }

    void ${options.name}::SetupTemplate(${!options.isBase ?  `Local<FunctionTemplate> parentTpl` : '' }) {

      // Constructor
      auto tpl = Nan::New<FunctionTemplate>(${options.name}::New);
      tpl->InstanceTemplate()->SetInternalFieldCount(1);
      tpl->SetClassName(Nan::New("Cairo${options.name}").ToLocalChecked());
${!options.isBase ?  `      tpl->Inherit (parentTpl);` : '' }

      ${methods.map(fn => {
        const jsName = getJSName(fn.name, base.prefix)
        const declaration =
          RESTRICTED.has(jsName.slice(0, -1)) ?
            `Nan::SetPrototypeMethod(tpl, "${jsName.slice(0, -1)}", ${jsName});` :
            `SET_PROTOTYPE_METHOD(tpl, ${jsName});`
        return addVersionGuard(fn, declaration, '      ')
      }).join('\n      ')
      }

      auto ctor = Nan::GetFunction (tpl).ToLocalChecked();

      ${staticMethods.map(fn =>
        (fn.attributes.ifdef ? `#ifdef ${fn.attributes.ifdef}\n      ` : '')
        + `SET_METHOD(ctor, ${getJSName(fn.name, base.prefix)});`
        + (fn.attributes.ifdef ? `\n      #endif` : '')
      ).join('\n      ')}

      constructorTemplate.Reset(tpl);
      constructor.Reset(ctor);

${options.isBase ? `
      ${namespaces.filter(ns => ns.name !== base.name).map(ns =>
        `${ns.name}::SetupTemplate(tpl);`).join('\n      ')}
` : ''}    }
  `
}

function generateInitializeMethod(options, namespaces) {
  return `
    void ${options.name}::Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target) {
      ${namespaces.map(ns =>
        `Nan::Set (target, Nan::New ("${ns.name}").ToLocalChecked(), ${ns.name}::GetConstructor());`).join('\n      ')}
    }
  `
}

function generateNewMethod(options) {
  const constructor = options.constructor
  const hasNew = constructor && constructor.parameters.length > 0 && constructor.parameters[0].attributes.new
  const newParam = hasNew ? constructor.parameters[0] : undefined
  const parameters =
    constructor ?
    (hasNew) ?
      constructor.parameters.slice(1) :
      constructor.parameters :
    undefined

  return `

    NAN_METHOD(${options.name}::New) {
      if (!info.IsConstructCall()) {
        return Nan::ThrowTypeError("Class constructors cannot be invoked without 'new'");
      }

      ${options.type}* data = NULL;

      if (info[0]->IsExternal()) {
        data = (${options.type}*) External::Cast (*info[0])->Value ();
      }${constructor ? `
      else if (info.Length() == ${parameters.length}) {
        ${parameters.map(getInArgumentSource).join('\n        ')}
        ${hasNew ? `
        data = new ${options.type} ();
        ${constructor.name} (${['data'].concat(parameters.map(p => p.name)).join(', ')});` : `
        data = ${constructor.name} (${constructor.parameters.map(p => p.name).join(', ')});`}
      }
      else {
        ${options.create ?
          options.create === 'new' ?
            `data = new ${options.type}();` :
            `data = ${options.create} ();` :
          `return Nan::ThrowError("Cannot instantiate ${options.name}: requires ${constructor.parameters.length} arguments");` }
      }` : `
      else {
        ${ options.create ?
          `data = ${options.create} ();` :
          `return Nan::ThrowError("Cannot instantiate ${options.name}: use static creators");` }
      }`}

      ${options.name}* instance = new ${options.name}(data);
      instance->Wrap(info.This());

      info.GetReturnValue().Set(info.This());
    }
  `
}

function getInArgumentSource(p, n) {
  const typeName = getTypeName(p.type)
  const baseName = p.type.name.replace('const ', '')

  if (typeName === 'double')
    return `auto ${p.name} = Nan::To<double>(info[${n}].As<Number>()).ToChecked();`

  if (typeName === 'double *' && p.attributes.inout)
    return `auto ${p.name} = Nan::To<double>(info[${n}].As<Number>()).ToChecked();`

  if (typeName === 'int')
    return `auto ${p.name} = Nan::To<int64_t>(info[${n}].As<Number>()).ToChecked();`

  if (typeName === 'unsigned int' || typeName === 'int unsigned')
    return `auto ${p.name} = Nan::To<int64_t>(info[${n}].As<Number>()).ToChecked();`

  if (typeName === 'const char *')
    return `auto ${p.name} = *Nan::Utf8String (info[${n}].As<String>());`

  if (baseName in ENUM_TYPE)
    return `auto ${p.name} = (${typeName}) Nan::To<${ENUM_TYPE[typeName]}>(info[${n}].As<Number>()).ToChecked();`

  if (baseName in WRAP_TYPE)
    return `auto ${p.name} = Nan::ObjectWrap::Unwrap<${WRAP_TYPE[baseName]}>(info[${n}].As<Object>())->_data;`

  if (EXTERNAL_TYPES.has(baseName))
    return `auto ${p.name} = (${typeName}) Nan::To<int64_t>(info[${n}].As<Number>()).ToChecked();`

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

  if (p.type.name === 'unsigned int' || p.type.name === 'int unsigned')
    return `unsigned int ${p.name} = 0;`

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

  if (p.attributes.out || p.attributes.inout)
    return '&' + p.name

  return p.name
}

function getReturn(fn, outArguments) {
  const lines = []
  const type = fn.type
  const typeName = fn.attributes.returns ?
    fn.attributes.returns :
    getTypeName(type)

  if (outArguments.length > 0) {
    console.assert(getTypeName(type) === 'void', 'Non-void with out arguments: ' + fn.name)

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
  else if (type.name in WRAP_TYPE || typeName.startsWith('wrap:')) {
    const realTypeName = typeName.startsWith('wrap:') ?
      typeName.replace('wrap:', '') :
      WRAP_TYPE[type.name]
    lines.push(`Local<Value> args[] = { Nan::New<External> (result) };`)
    lines.push(`Local<Function> constructor = Nan::New<Function> (${realTypeName}::constructor);`)
    lines.push(`Local<Value> returnValue = Nan::NewInstance(constructor, 1, args).ToLocalChecked();`)
  }
  else if (typeName === 'const char *') {
    lines.push(`Local<Value> returnValue = UTF8 (result);`)
  }
  else if (typeName !== 'void') {
    const cast = type.name in CAST_TYPE ? `(${CAST_TYPE[type.name]}) ` : ''
    lines.push(`Local<Value> returnValue = Nan::New (${cast}result);`)
  }

  lines.push(`info.GetReturnValue().Set(returnValue);`)

  return lines.join('\n      ')
}

function getAttachMethods(name, functions) {
  return unindent(`
    #define SET_METHOD(tpl, name) Nan::SetPrototypeMethod(tpl, #name, name)

    static void AttachMethods(Local<FunctionTemplate> tpl) {
        ${functions.map(fn =>
          (fn.attributes.version ? (() => {
            const [major, minor, micro] = fn.attributes.version.split('.')
            return '#if ' + [
              (major ? 'CAIRO_VERSION_MAJOR >= ' + major : undefined),
              (minor ? 'CAIRO_VERSION_MINOR >= ' + minor : undefined),
              (micro ? 'CAIRO_VERSION_MICRO >= ' + micro : undefined),
            ].filter(Boolean).join(' && ') + '\n        '
          })() : '')
          + `SET_METHOD(tpl, ${getJSName(fn.name)});`
          + (fn.attributes.version ? '\n        #endif' : '')
        ).join('\n        ')}
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
    !p.attributes.out && !p.attributes.inout
    && !(i === 0
      && (p.type.name === selfType || p.type.name === 'const ' + selfType)
      && !fn.attributes.static)
  )
}

function getOutArguments(fn) {
  return fn.parameters.filter(p =>
    p.attributes.out
  )
}

function getInOutArguments(fn) {
  return fn.parameters.filter(p =>
    p.attributes.inout
  )
}

function getTypeName(type) {
  const result = type.name + (type.pointer ? ' ' + type.pointer : '')
  return result
        .replace(/(.*) unsigned/, 'unsigned $1')
}

function getJSName(originalName, prefix = 'cairo_') {
  const jsName = camelCase(originalName.replace(prefix, ''))
  return RESTRICTED.has(jsName) ? `${jsName}_` : jsName
}

function addVersionGuard(fn, text, indent) {
  return (fn.attributes.version ? (() => {
    const [major, minor, micro] = fn.attributes.version.split('.')
    return '#if ' + [
      (major ? 'CAIRO_VERSION_MAJOR >= ' + major : undefined),
      (minor ? 'CAIRO_VERSION_MINOR >= ' + minor : undefined),
      (micro ? 'CAIRO_VERSION_MICRO >= ' + micro : undefined),
    ].filter(Boolean).join(' && ') + `\n${indent}`
  })() : '')
  + text
  + (fn.attributes.version ? `\n${indent}#endif` : '')
}

function getVersionGuard(fn) {
  if (!fn.attributes.version)
    return undefined
  const [major, minor, micro] = fn.attributes.version.split('.')
  const start = '#if ' + [
    (major ? 'CAIRO_VERSION_MAJOR >= ' + major : undefined),
    (minor ? 'CAIRO_VERSION_MINOR >= ' + minor : undefined),
    (micro ? 'CAIRO_VERSION_MICRO >= ' + micro : undefined),
  ].filter(Boolean).join(' && ')
  const end = `#endif`
  return [start, end]
}
