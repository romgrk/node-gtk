/*
 * __common__.js
 */

module.exports = {
  assert,
  expect,
}


function assert(condition, message) {
  if (condition)
    return
  console.error(message)
  process.exit(1)
}

function expect(value, expected) {
  assert(value === expected,
    `Expected: "${expected}"\nActual: "${value}"`)
}
