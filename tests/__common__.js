/*
 * __common__.js
 */

exports.assert = function assert(condition, message) {
  if (condition)
    return

  console.error(message)
  process.exit(1)
}
