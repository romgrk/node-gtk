/*
 * utils.js
 */

module.exports = {
  override,
  countUtf8Bytes,
}

function override(target, methodName, modifierFunction) {
  const fn = target.prototype[methodName]
  target.prototype[methodName] = modifierFunction(fn)
}

function countUtf8Bytes(s){
  let b = 0
  let i = 0
  let c
  for (; c = s.charCodeAt(i++); b += c >> 11 ? 3 : c >> 7 ? 2 : 1);
  return b
}

