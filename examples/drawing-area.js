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

// Button
const button = Gtk.ToolButton.newFromStock(Gtk.STOCK_GO_BACK)

// Draw area
const drawingArea = new Gtk.DrawingArea()
drawingArea.on('draw', (context) => {
  const width = drawingArea.getAllocatedWidth()
  const height = drawingArea.getAllocatedHeight()

  console.log(['draw', { width, height }])

  // Cairo in GJS uses camelCase function names
  context.setSourceRgba(1, 0.0, 0.0, 1)
  context.arc(16, 16, 16, 0, 2 * Math.PI);
  context.fill()

  context.setSourceRgba(0.1, 0.1, 0.1, 1)
  context.rectangle(10, 40, 100, 20)
  context.fill()

  context.selectFontFace("Fantasque Sans Mono", Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL)
  context.setFontSize(12)

  context.moveTo(10, 50)
  context.setSourceRgba(1, 0.0, 0.0, 1)
  context.showText("Disziplin ist Macht.")

  context.setLineWidth (2)

  context.moveTo(200, 100)
  context.lineTo(200, 300)

  context.moveTo(100, 200)
  context.lineTo(300, 200)

  context.stroke()

  return true
})

// Containing box
const vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
vbox.packStart(button,      false, true, 0)
vbox.packStart(drawingArea, true, true, 0)


// configure main window
window.setDefaultSize(1200, 720)
window.setResizable(true)
window.add(vbox)

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
