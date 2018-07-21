/*
 * __common__.js
 */

const chalk = require('chalk')

module.exports = {
  assert,
  expect,
  describe,
  it,
  mustThrow,
}

let calledIt
let currentTest
let currentSubtest

function assert(condition, message) {
  if (condition)
    return;

  _failed(message)

  process.exit(1)
}

function expect(value, expected) {
  assert(value === expected,
    `Expected: "${expected}"\nActual: "${value}"`)
}

function describe(message, fn) {
  currentTest = message
  calledIt = false
  try {
    fn()
  } catch(e) {
    _failed()
    console.error(e)
    process.exit(1)
  }
  if (!calledIt)
    _success()
  currentTest = undefined
}

function it(message, fn) {
  currentSubtest = message
  calledIt = true
  try {
    fn()
  } catch(e) {
    _failed()
    console.error(e)
    process.exit(1)
  }
  _success()
  currentSubtest = undefined
}

function mustThrow(message, fn) {
  return function() {
    let didThrow = false
    try {
      fn()
    } catch(e) {
      if (e.message !== message) {
        _failed(`Expected message to be "${message}", got "${e.message}"`)
        process.exit(1)
      }
      didThrow = true
    }
    if (!didThrow) {
      _failed(`Expected to throw "${message}"`)
      process.exit(1)
    }
  }
}


// Helpers

function _getDescription() {
  let result = ''

  if (currentTest)
    result += currentTest

  if (currentSubtest)
    result += ' ' + currentSubtest

  return result
}

function _log(...args) {
  let description = _getDescription()
  if (description)
    console.log(`${description}` + (args.length > 0 ? ':' : ''), ...args)
  else
    console.log(...args)
}

function _error(...args) {
  let description = _getDescription()
  if (description)
    console.error(`${description}` + (args.length > 0 ? ':' : ''), ...args)
  else
    console.error(...args)
}

function _failed(...args) {
  let description = _getDescription()
  if (description)
    console.error(`${chalk.red.bold('Failed:')} ${chalk.bold(description)}`,
      + (args.length > 0 ? ':' : ''), ...args)
  else
    console.error(chalk.red.bold('Failed:'), ...args)
}

function _success(...args) {
  let description = _getDescription()
  if (description)
    console.log(`${chalk.green.bold('Success:')} ${chalk.bold(description)}`
     + (args.length > 0 ? ':' : ''), ...args)
  else
    console.log(chalk.green.bold('Success:'), ...args)
}

