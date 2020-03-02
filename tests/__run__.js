/*
 * __run__.test.js
 */
/* global it */

const fs = require('fs')
const path = require('path')
const child_process = require('child_process')

const files = fs.readdirSync(__dirname).filter(f => !path.basename(f).startsWith('__'))

const watchdog = setTimeout(() => {
  console.error('Error: 10 minutes timeout reached')
  process.exit(1)
}, 10 * 60 * 1000)
watchdog.unref()

files.forEach(file => {

  it(file, function(done) {
    const currentTest = this
    currentTest.timeout(15000)

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
