/*
 * __run__.test.js
 */
/* global it */

const fs = require('fs')
const path = require('path')
const child_process = require('child_process')

const files = fs.readdirSync(__dirname).filter(f => !path.basename(f).startsWith('__'))

files.forEach(file => {

  it(file, function(done) {
    this.timeout(15000)

    const cmd = `node ${path.join(__dirname, file)}`
    const options = {
      maxBuffer: 10 * 1024 * 1024,
    }

    child_process.exec(cmd, options, (error, stdout, stderr) => {
      if (error)
        done(error)
      else
        done()
    })
  })
})
