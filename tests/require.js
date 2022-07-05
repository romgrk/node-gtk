/*
 * require.js
 */

const fs = require('fs')
const path = require('path')
const child_process = require('child_process')
const chalk = require('chalk')
const gi = require('../lib/')
const { describe, it, mustThrow, expect, assert } = require('./__common__.js')

let doneCount = 0

const showWarnings = process.argv.includes('--show-warnings')

// These errors are typelib errors
const notOurFaultPatterns = [
  /Typelib file .* contains version .* which doesn't match the expected version/,
  /Typelib file .* contains namespace .* which doesn't match the file name/,
]

describe('gi.require() works for all modules', async () => {

  const searchPaths = gi._GIRepository.Repository_get_search_path()

  console.log('Search path:')
  console.log(searchPaths)
  console.log('')

  const modules =
    searchPaths.filter(path => fs.existsSync(path))
               .map(path => fs.readdirSync(path).map(parseModule))
               .reduce((acc, cur) => acc.concat(cur), [])

  console.log(`${modules.length} modules found`)

  const results = await Promise.all(modules.map(testRequire))

  console.log('')

  let allOk = true

  results.forEach(({ ok, loaded, module, error, output }) => {
    if (ok)
      return

    allOk = allOk && ok

    if (!loaded) {
      console.log(chalk.bold(`${module.name}@${module.version} (${module.filename})` + (ok ? ' (not our fault)' : '')))
      console.log(error)
      console.log('')
      console.log(output)
    }
  })

  assert(allOk, 'some modules failed to load')
})

function testRequire(module, i, modules) {
  return new Promise((resolve, reject) => {
    const modulePath = path.posix.join(__dirname, '..')
    const cmd = `node -e "const gi = require('${modulePath}'); gi.require('${module.name}', '${module.version}')"`
    const options = {
      maxBuffer: 10 * 1024 * 1024,
    }

    child_process.exec(cmd, options, (error, stdout, stderr) => {
      console.log(`[${doneCount++}/${modules.length}] ${module.name}@${module.version}: ${error === null}`)

      const output = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n')

      if (!error) {
        if (output.includes('[WARN]') && showWarnings)
          console.log(output)
        return resolve({ ok: true, loaded: true, module, output })
      }

      if (notOurFaultPatterns.some(p => p.test(error.message))) {
        if (output.includes('[WARN]') && showWarnings)
          console.log(output)
        return resolve({ ok: true, loaded: false, module, error, output })
      }

      const newError = new Error(output)
      newError.stack = ''
      resolve({ ok: false, loaded: false, module, error: newError, output })
    })
  })
}

function parseModule(filename) {
  const [name, version] = filename.split('.').slice(0, -1).join('.').split('-')
  return { name, version, filename }
}
