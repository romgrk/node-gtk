/*
 * Gio-2.0.js
 */

const { runLoopEntry } = require('../loop.js')

exports.apply = (Gio) => {

    Gio.Application.prototype._run = Gio.Application.prototype.run

    /* g_application_run() blocks until the application quits. Under ES modules
     * this would starve Promise/async continuations; runLoopEntry() defers the
     * blocking call when needed so they keep draining. See loop.js / #442.
     *
     * Note: when deferred (ESM), the exit status is not available synchronously,
     * so `app.run()` returns undefined instead of the status code in that case. */
    Gio.Application.prototype.run = function run(...args) {
        return runLoopEntry(() => {
            /* Run before we enter the loop otherwise pending microtasks
             * are not run */
            process._tickCallback()

            return this._run(...args)
        })
    }
}
