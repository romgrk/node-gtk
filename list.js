/*
 * list.js
 */

const skip = new Set(['NM', 'Rest'])

const inspect = require('./lib/inspect.js')
const libs =
  inspect.getLibs()
  .map(([_, name, version]) => name)
  .filter(name => !skip.has(name))

console.log(libs)

libs.forEach((name) => {
  try {
    inspect.parseNamespace(name)
  } catch(e) {
    console.log(e)
    return
  }
  console.log(name)
})

global.i = inspect
