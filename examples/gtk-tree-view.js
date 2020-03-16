/*
 * gtk-tree-view.js
 */


const gi = require('../lib')
const Gtk = gi.require('Gtk', '3.0')
const GObject = gi.require('GObject')

gi.startLoop()
Gtk.init()



// Model

const types = [GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_FLOAT]
const books = [
  ['L\'étranger',                             'Albert Camus',   10.76],
  ['L\'élégance du Hérisson',                 'Muriel Barbery', 25.94],
  ['Le Vieux qui lisait des romans d\'amour', 'Luis Sepulveda', 10.76],
]

const store = new Gtk.ListStore()
store.setColumnTypes(types)

books.forEach(book => store.appendRow(book, types))



// View

const treeView = new Gtk.TreeView({ model: store })

{
  const column = new Gtk.TreeViewColumn({ title: 'Title and Author' })

  const title = new Gtk.CellRendererText()
  const author = new Gtk.CellRendererText()

  column.packStart(title, true)
  column.packStart(author, true)

  column.addAttribute(title,  'text', 0)
  column.addAttribute(author, 'text', 1)

  treeView.appendColumn(column)
}
{
  const price = new Gtk.CellRendererText()
  const column = new Gtk.TreeViewColumn({ title: 'Price ($CAN)' })

  column.packStart(price, true)

  column.addAttribute(price,  'text', 2)

  treeView.appendColumn(column)
}


// configure main window
const window = new Gtk.Window({ type : Gtk.WindowType.TOPLEVEL })
window.setDefaultSize(500, 300)
window.setResizable(true)
window.add(treeView)


window.on('show', Gtk.main)
window.on('destroy', Gtk.mainQuit)
window.on('delete-event', () => false)



/*
 * Main
 */

main()

function main() {
  window.showAll()
}
