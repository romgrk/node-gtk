/*
 * gtk-tree-store.js
 */

const path = require('path')
const gi = require('../')
const Gtk = gi.require('Gtk', '3.0')
const GdkPixbuf = gi.require('GdkPixbuf')
const GObject = gi.require('GObject')

gi.startLoop()
Gtk.init()


const TYPE_FLOAT  = GObject.typeFromName('gfloat')
const TYPE_STRING = GObject.typeFromName('gchararray')
const TYPE_PIXBUF = GObject.typeFromName('GdkPixbuf') // Gtk.ImageType.PIXBUF

const store = new Gtk.TreeStore()
store.setColumnTypes([TYPE_STRING, TYPE_PIXBUF])

addRow()
addRow()
addRow()

function addRow() {
  const iter = store.append()
  {
    // Add string
    const value = new GObject.Value()
    value.init(TYPE_STRING)
    value.setString('Image:')

    store.setValue(iter, 0, value)
  }
  {
    // Add Pixbuf
    const pixbuf = GdkPixbuf.Pixbuf.newFromFile(path.join(__dirname, 'logo.png'))

    const value = new GObject.Value()
    value.init(TYPE_PIXBUF)
    value.setObject(pixbuf)

    store.setValue(iter, 1, value)
  }
}


// View

const treeView = new Gtk.TreeView({ model: store })

{
  const column = new Gtk.TreeViewColumn({ title: 'Caption' })
  const caption = new Gtk.CellRendererText()

  column.packStart(caption, true)
  column.addAttribute(caption,  'text', 0)

  treeView.appendColumn(column)
}
{
  const column = new Gtk.TreeViewColumn({ title: 'Image' })
  const image = new Gtk.CellRendererPixbuf()

  column.packStart(image, true)
  column.addAttribute(image,  'pixbuf', 1)

  treeView.appendColumn(column)
}


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
