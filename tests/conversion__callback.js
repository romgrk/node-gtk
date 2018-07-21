/*
 * conversion__callback.js
 */


const gi = require('../lib/')
const GLib = gi.require('GLib')
const Gio = gi.require('Gio')
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


/*
 * calls the callback (no GDestroyNotify, no user_data)
 */
{
  let didCall = false

  const loop = new GLib.MainLoop(null, false);
  const task = Gio.Task.new(undefined, undefined, (object, result, user_data) => {
    console.log('Called:', [object, result, user_data])
    didCall = true
    loop.quit();
  })
  task.returnBoolean(true);
  loop.run()

  common.assert(didCall, 'Gio.Task callback not called')
  console.log('Success: callbacks are called')
}


/*
 * calls the callback (GDestroyNotify before, user_data)
 */
{
  common.assert(false, 'implement me')
}


/*
 * calls the callback (GDestroyNotify after, user_data)
 */
{
  common.assert(false, 'implement me')
}


/*
 * return value is returned
 */
{
  common.assert(false, 'implement return values test')
/*   let count = 0
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
 *   }, 500) */
}


/*
 * return value type is checked
 */
{
  common.assert(false, 'implement return value test')
}


/*
 * propagates exceptions
 */
{
  let didThrow = false

  process.on('uncaughtException', (error) => {
    common.expect(error.message, 'test')
    didThrow = true
  })

  const loop = new GLib.MainLoop(null, false);
  const task = Gio.Task.new(undefined, undefined, (object, result, user_data) => {
    throw new Error('test')
  })
  task.returnBoolean(true);
  loop.run()

  common.assert(didThrow, 'exception was not thrown')
  console.log('Success: exceptions in callbacks are thrown')
}
