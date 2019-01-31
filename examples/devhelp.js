/*
 * devhelp.js
 */

const gi = require('..')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()

// Main program window
const window = new Gtk.Window({
  type : Gtk.WindowType.TOPLEVEL
})

const sidebar = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
const input = new Gtk.SearchEntry()
const list = new Gtk.ListBox()
setListItems(list, Array(100).fill(0).map((_, i) => `Item ${i}`))
list.on('row-selected', onRowSelected)
sidebar.packStart(input, false, false, 0)
sidebar.packStart(scrollable(list),  true,  true,  0)

const paned = new Gtk.Paned({ orientation: Gtk.Orientation.HORIZONTAL })
const right = new Gtk.Label({ label: 'right' })
paned.add1(sidebar)
paned.add2(right)


window.setDefaultSize(800, 600)
window.setResizable(true)
window.add(paned)

window.on('show', Gtk.main)
window.on('destroy', Gtk.mainQuit)
window.showAll()

function onRowSelected(row) {
  const label = row.getChildren()[0]
  console.log(row)
  console.log(label.label)
  right.label = label.label
}

function setListItems(list, items) {
  const rows = []
  items.forEach(item => {
    const row = new Gtk.ListBoxRow()
    row.add(new Gtk.Label({ label: item }))
    list.add(row)
    rows.push(row)
  })
  return rows
}

function scrollable(widget) {
  const scrolledWindow = new Gtk.ScrolledWindow()
  scrolledWindow.add(widget)
  return scrolledWindow
}
