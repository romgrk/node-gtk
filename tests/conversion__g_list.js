/*
 * glist.js
 */

const gi = require('../lib/')

const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init(null, 0)

const window = new Gtk.Window({
  type : Gtk.WindowType.TOPLEVEL
})

const flowBox = new Gtk.FlowBox()

const button = {
  back:    Gtk.ToolButton.newFromStock(Gtk.STOCK_GO_BACK),
  forward: Gtk.ToolButton.newFromStock(Gtk.STOCK_GO_FORWARD),
  refresh: Gtk.ToolButton.newFromStock(Gtk.STOCK_REFRESH),
}

// where the URL is written and shown
const urlBar = new Gtk.Entry()

flowBox.add(button.back)
flowBox.add(button.forward)
flowBox.add(button.refresh)
flowBox.add(urlBar)

// configure main window
window.setDefaultSize(400, 100)
window.setResizable(true)
window.connect('show', () => {
  setTimeout(() => {
    const list = flowBox.getSelectedChildren()
    console.log(list)
    Gtk.mainQuit()
  }, 50)
  Gtk.main()
})

window.connect('destroy', () => Gtk.mainQuit())
window.connect('delete-event', () => false)

// add vertical ui and show them all
window.add(flowBox)
window.showAll()
