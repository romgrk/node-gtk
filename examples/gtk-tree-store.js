/*
 * gtk-tree-store.js
 */

const path = require('path')
const gi = require('../')
const Gtk = gi.require('Gtk', '3.0')
const GdkPixbuf = gi.require('GdkPixbuf')
const GObject = gi.require('GObject')

const TYPE_PIXBUF = GObject.typeFromName('GdkPixbuf')
const { TYPE_FLOAT, TYPE_STRING, TYPE_INT, TYPE_BOOLEAN } = GObject

const logo = path.join(__dirname, 'logo.png')

gi.startLoop()
Gtk.init()

const types = [TYPE_STRING, TYPE_PIXBUF, TYPE_INT, TYPE_BOOLEAN, TYPE_BOOLEAN]
const store = new Gtk.TreeStore()
store.setColumnTypes(types)

store.appendRow(['Image 1', GdkPixbuf.Pixbuf.newFromFile(logo), 12, true, true], types)
store.appendRow(['Image 2', GdkPixbuf.Pixbuf.newFromFile(logo), 0, false, false], types)
store.appendRow(['Image 3', GdkPixbuf.Pixbuf.newFromFile(logo), 85, true, false], types)



// View

const treeView = new Gtk.TreeView({ model: store })
treeView.appendColumn({ title: 'Caption', type: 'text' })
treeView.appendColumn({ title: 'Image', type: 'pixbuf' })
treeView.appendColumn({ title: 'Progress', type: 'progress' })
treeView.appendColumn({ title: 'Spinner', type: 'spinner' })
treeView.appendColumn({ title: 'Toggle', type: 'toggle' })


// configure main window
const window = new Gtk.Window({ type : Gtk.WindowType.TOPLEVEL })
window.setDefaultSize(500, 300)
window.setResizable(true)
window.add(treeView)


window.on('show', () => {
  Gtk.main()
})
window.on('destroy', () => Gtk.mainQuit())
window.on('delete-event', () => false)



/*
 * Main
 */

main()

function main() {
  window.showAll()
}
