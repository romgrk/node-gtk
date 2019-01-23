/*
 * drawing-area.js
 */

const gi = require('../')
const Gtk = gi.require('Gtk', '3.0')
const Cairo = gi.require('cairo')

Gtk.init()

// Main program window
const window = new Gtk.Window({
  type : Gtk.WindowType.TOPLEVEL
})

// Draw area
const drawingArea = new Gtk.DrawingArea()
drawingArea.on('draw', (context) => {
  const width = drawingArea.getAllocatedWidth()
  const height = drawingArea.getAllocatedHeight()

  console.log({ width, height })
  console.log(context.__proto__)
  console.log(context.__proto__.prototype)

  // Cairo in GJS uses camelCase function names
  // cr.setSourceRGB(1.0, 0.0, 0.0);
  // cr.setOperator(Cairo.Operator.DEST_OVER);
  // cr.arc(16, 16, 16, 0, 2*Math.PI);
  // cr.fill();

  console.log(['draw', context])

  return true
})

// configure main window
window.setDefaultSize(1200, 720)
window.setResizable(true)
window.add(drawingArea)

// window show event
window.on('show', () => {
  Gtk.main()
})

// window after-close event
window.on('destroy', () => Gtk.mainQuit())

// window close event: returning true has the semantic of preventing the default behavior:
// in this case, it would prevent the user from closing the window if we would return `true`
window.on('delete-event', () => false)
window.showAll()
