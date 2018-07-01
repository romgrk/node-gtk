/*
 * list.js
 */

const inspect = require('./lib/inspect.js')
const libs = ['Gtk', 'Gdk', 'GLib', 'Soup', 'Clutter']

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


const typeNames = Array.from(new Set(inspect.infos.map(i => i.infoType)))
const types = {}
typeNames.forEach(typeName => {
  types[typeName] = inspect.infos.filter(i => i.infoType === typeName)
})

global.inspect = inspect
global.infos = inspect.infos
global.types = types
global.logFn = i =>
  i.type === 'function' ?
    console.log(inspect.formatFunction(i)) :
    console.log(inspect.formatFunction(i.parent))
