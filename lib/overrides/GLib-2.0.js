/*
 * GLib-2.0.js
 */

const internal = require('../native.js')

exports.apply = (GLib) => {

    GLib.MainLoop.prototype._run = GLib.MainLoop.prototype.run
    GLib.MainLoop.prototype.run = function run() {
        const loopStack = internal.GetLoopStack()

        loopStack.push(() => this.quit())
        this._run()
        loopStack.pop()
    }
}
