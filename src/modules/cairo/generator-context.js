/*
 * generator-context.js
 */

const fs = require('fs')
const path = require('path')
const util = require('util')

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
} = require('./generator.js')


util.inspect.defaultOptions = { depth: 6 }

generateCairoContext()

function generateCairoContext() {
  const result = parseFile(path.join(__dirname, 'context.nid'))

  const declarations = result.declarations
  const functions = declarations.filter(d => d.function).map(d => d.function)

  console.assert(declarations.length === functions.length, 'declarations.length === functions.length is false')

  // logFn(functions.find(f => f.name === 'cairo_text_extents'))
  // functions.map(logFn)

  console.log(generateSource('CairoContext', functions))
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

