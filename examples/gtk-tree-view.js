/*
 * gtk-tree-view.js
 */


const gi = require('../lib/')
const Gtk = gi.require('Gtk', '3.0')
const GObject = gi.require('GObject')

gi.startLoop()
Gtk.init()


// https://github.com/GNOME/pygobject/blob/fc50ca98835b0b1d6395a4e05e128d759044eab8/gi/_constants.py
const TYPE_FLOAT  = GObject.typeFromName('gfloat')
const TYPE_STRING = GObject.typeFromName('gchararray')

const TYPE = {
  'string': TYPE_STRING,
  'number': TYPE_FLOAT,
}

// https://developer.gnome.org/gobject/stable/gobject-Standard-Parameter-and-Value-Types.html
const TYPE_FN = {
  'string': 'setString',
  'number': 'setFloat',
}

function appendRow(store, row) {
  const iter = store.append()

  for (let i = 0; i < row.length; i++) {
    const item = row[i]
    const type = TYPE[typeof item]
    const typeFn = TYPE_FN[typeof item]
    const value = new GObject.Value()
    value.init(type)
    value[typeFn](item)
    store.setValue(iter, i, value)
  }
}


// Model

const books = [
  ['L\'étranger',                             'Albert Camus',   10.76],
  ['L\'élégance du Hérisson',                 'Muriel Barbery', 25.94],
  ['Le Vieux qui lisait des romans d\'amour', 'Luis Sepulveda', 10.76],
]

const store = new Gtk.ListStore()
store.setColumnTypes([TYPE_STRING, TYPE_STRING, TYPE_FLOAT])

books.forEach(book => appendRow(store, book))



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
