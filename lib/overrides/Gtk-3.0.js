/*
 * Gtk-3.0.js
 */

const internal = require('../native.js')

exports.apply = (Gtk) => {

    const originalMain = Gtk.main
    Gtk.main = function main() {
        const loopStack = internal.GetLoopStack()

        loopStack.push(Gtk.mainQuit)
        originalMain()
        loopStack.pop()
    }

}
