/*
 * __run__.test.js
 */
/* global it */

const fs = require('fs')
const path = require('path')
const child_process = require('child_process')

const files = fs.readdirSync(__dirname).filter(f => !path.basename(f).startsWith('__'))

files.forEach(file => {
  it(file, (done) => {
    child_process.exec(`node ${path.join(__dirname, file)}`, (error, stdout, stderr) => {
      if (error)
        done(error)
      else
        done()
    })
  })
})
