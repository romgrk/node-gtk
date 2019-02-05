/*
 * unindent.js
 */


module.exports = unindent

function unindent(input) {
  input = input.replace(/^(\s*\n)+/, '')
  const lines = input.split('\n').filter(line => !/^\s*$/.test(line))
  const smallestIndent = lines.reduce((acc, cur) => {
    if (/^\s*$/.test(cur))
      return acc
    const currentIndent = cur.match(/^ */)[0].length
    return acc > currentIndent ?  currentIndent : acc
  }, lines[0].match(/^ */)[0].length)

  return input.replace(new RegExp('^' + ' '.repeat(smallestIndent), 'mg'), '').replace(/\s*$/, '')
}
