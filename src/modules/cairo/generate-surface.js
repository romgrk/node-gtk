/*
 * generate-surface.js
 */

const path = require('path')
const util = require('util')
const unindent = require('unindent')

const {
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
} = require('./generator.js')


util.inspect.defaultOptions = { depth: 6 }

generateCairoSurface()

function generateCairoSurface() {
  const result = parseFile(path.join(__dirname, 'cairo-surface.nid'))
  const declarations = result.declarations

  console.log(declarations)

  const namespaces = declarations.map((cur) => {
    const name = cur.namespace.name
    const options = { name, constructor: null, functions: null, isBase: name === 'Surface' }

    const allFunctions =
      cur.namespace.declarations
        .filter(d => d.function)
        .map(d => {
          const fn = d.function
          fn.source = generateClassMethodSource(fn, options)
          return fn
        })

    options.constructor = allFunctions.filter(fn => fn.attributes.constructor)[0]
    options.functions = allFunctions.filter(fn => fn.attributes.constructor !== true)

    return options
  })


  /* ImageSurface
   * PDFSurface
   * PostScriptSurface
   * RecordingSurface
   * Win32Surface
   * SVGSurface
   * QuartzSurface */

  const classDeclarations = namespaces.map(generateClassDeclaration)
  const classVariables    = namespaces.map(generateClassVariables)
  const initializeMethods = namespaces.map(generateInitializeMethod)
  const newMethods = namespaces.map(generateNewMethods)
  const methods = namespaces.map(ns => ns.functions.map(fn => fn.source).join('\n'))

  console.log(newMethods.join('\n'))

  // namespaces.forEach(ns => ns.functions.forEach(((fn, i) => console.log(generateClassMethodSource(fn, ns)))))

  // const functions = declarations.filter(d => d.function).map(d => d.function)

  // console.assert(declarations.length === functions.length)

  // logFn(functions.find(f => f.name === 'cairo_text_extents'))
  // functions.map(logFn)

  // console.log(generateSource('CairoSurface', functions))
}

// Helpers

function generateClassDeclaration(options) {

  return unindent(`
    class ${options.name}: public ${options.isBase ? 'Nan::ObjectWrap' : 'Surface'} {
      public:
        static Nan::Persistent<v8::FunctionTemplate> constructorTemplate;
        static Nan::Persistent<v8::Function>         constructor;
        static void Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target);
        static NAN_METHOD(New);

        ${options.functions.map(fn => `static NAN_METHOD(${getFunctionJSName(fn)})`).join('\n        ')}
${options.isBase ? `
        ${options.name}(cairo_surface_t* data);
        ~${options.name}();

        cairo_surface_t* _data;
` : `
        ${options.name}(cairo_surface_t* data) : Surface(data) {};
`}    };
  `)
}

function generateClassVariables(options) {
  return unindent(`
    Nan::Persistent<FunctionTemplate> ${options.name}::constructorTemplate;
    Nan::Persistent<Function>         ${options.name}::constructor;
  `)
}

function generateInitializeMethod(options) {

  const staticMethods = options.functions.filter(fn => fn.attributes.static)
  const methods = options.functions.filter(fn => fn.attributes.static !== true)

  return unindent(`
    void ${options.name}::Initialize(
        Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target${!options.isBase ?  `,
        Local<FunctionTemplate> parentTpl` : '' }) {

      // Constructor
      auto tpl = Nan::New<FunctionTemplate>(${options.name}::New);
      tpl->InstanceTemplate()->SetInternalFieldCount(1);
      tpl->SetClassName(Nan::New("Cairo${options.name}").ToLocalChecked());
${!options.isBase ?  `      tpl->Inherit (parentTpl);` : '' }
      constructorTemplate.Reset(tpl);

      ${methods.map(fn => `SET_PROTOTYPE_METHOD(tpl, ${getFunctionJSName(fn)})`).join('\n      ')}

      auto ctor = tpl->GetFunction();
      constructor.Reset(ctor);

      ${staticMethods.map(fn => `SET_METHOD(ctor, ${getFunctionJSName(fn)})`).join('\n      ')}

      Nan::Set (target, Nan::New ("${options.name}").ToLocalChecked(), ctor);
${options.isBase ? `
      ImageSurface::Initialize(target, tpl);
      PDFSurface::Initialize(target, tpl);
      PostScriptSurface::Initialize(target, tpl);
      RecordingSurface::Initialize(target, tpl);
      Win32Surface::Initialize(target, tpl);
      SVGSurface::Initialize(target, tpl);
      QuartzSurface::Initialize(target, tpl);
` : ''}    }
  `)
}

function generateClassMethodSource(fn, options) {
  const selfArgument = fn.attributes.static !== true ? fn.parameters[0] : undefined
  const inArguments  = getInArguments(fn, 'cairo_surface_t')
  const outArguments = getOutArguments(fn, 'cairo_surface_t')
  const hasResult = getTypeName(fn.type) !== 'void' || outArguments.length > 0

  console.log(fn, inArguments)
  return unindent(`
    NAN_METHOD(${options.name}::${getFunctionJSName(fn)}) {${selfArgument ? `
        auto self = info.This();
        auto ${selfArgument.name} = Nan::ObjectWrap::Unwrap<${options.name}>(self)->_data;
` : ''}${inArguments.length > 0 ? `
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

function generateNewMethod(options) {
  throw new Error('not implemented')
}

function getFunctionJSName(fn) {
  return getJSName(fn.name, /cairo_[a-z0-9]+(_surface)?/)
}
