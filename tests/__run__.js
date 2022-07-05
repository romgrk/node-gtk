/*
 * __run__.test.js
 */
/* global it */

const fs = require('fs')
const path = require('path')
const child_process = require('child_process')

const files =
  [
    fs.readdirSync(__dirname),
    fs.readdirSync(__dirname + '/cairo').map(f => path.join('cairo', f)),
  ]
  .reduce((acc, cur) => acc.concat(cur), [])
  .filter(f => f.endsWith('.js') && !path.basename(f).startsWith('__'))

const watchdog = setTimeout(() => {
  console.error('Error: 10 minutes timeout reached')
  process.exit(1)
}, 10 * 60 * 1000)
watchdog.unref()

// usage: npx mocha [--skip=pat1[,pat2...]] [--skip=...] tests/__run__.js
const skipPatterns = process.argv
  .filter(a => a.startsWith('--skip='))
  .flatMap(a => a.replace('--skip=', '').split(','))
  .map(a => new RegExp(a))

files.forEach(file => {

  if (skipPatterns.reduce((acc, pat) => acc || pat.test(file), false))
    return

  it(file, function(done) {
    const currentTest = this
    currentTest.timeout(8 * 60 * 1000)

    const cmd = `node --expose-gc "${path.join(__dirname, file)}"`
    const options = {
      maxBuffer: 10 * 1024 * 1024,
    }

    child_process.exec(cmd, options, (error, stdout, stderr) => {
      if (!error)
        return done()

      if (error.code === 222)
        return currentTest.skip()

      if (!error.message.includes('Command failed'))
        return done(error)

      const newError = new Error(stderr + stdout)
      newError.stack = ''
      done(newError)
    })
  })
})

function parseSkip(flag) {
    const pattern = flag.split('=')[1]
    return new RegExp(pattern)
}
