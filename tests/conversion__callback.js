/*
 * conversion__callback.js
 */


const gi = require('../lib/')
const GLib = gi.require('GLib')
const common = require('./__common__.js')


/*
 * fails when function has GDestroyNotify but not user_data
 */
{
  let didThrow = false

  try {
    GLib.testAddDataFuncFull(__filename, function(...args) {
      console.log('Called:', args)
    })
  } catch (e) {
    didThrow = true
    common.expect(e.message, 'Function GLib.test_add_data_func_full has a GDestroyNotify but no user_data, not supported')
  }

  common.assert(didThrow, 'GLib.test_add_data_func_full didnt throw')
  console.log('Success: GLib.test_add_data_func_full did throw')
}

{
  let didCall = false

  const loop = new GLib.MainLoop(null, false);
  const task = Gio.Task.new(undefined, undefined, (_, result) => {
    console.log('Called:', _, result)
    didCall = true
    common.expect(result, false)
    loop.quit();
  })
  task.returnBoolean(true);
  loop.run()

  common.assert(didCall, 'Gio.Task callback not called')
}

/* {
 *   let count = 0
 * 
 *   const source = glib.timeoutAdd(glib.PRIORITY_HIGH, 100, function() {
 *       console.log('called')
 * 
 *       count += 1
 * 
 *       return glib.SOURCE_REMOVE
 *   })
 * 
 *   setTimeout(() => {
 *       common.assert(count > 0, 'callback was not called')
 *       common.assert(count === 1, 'callback wasnt stopped (JS value not returned)')
 * 
 *       console.log('Done')
 *       process.exit(0)
 *   }, 500)
 * } */
