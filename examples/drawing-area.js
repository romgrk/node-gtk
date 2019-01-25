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

  console.log(['draw', context, { width, height }])

  // Cairo in GJS uses camelCase function names
  context.setSourceRGB(1.0, 0.0, 0.0);
  context.setOperator(Cairo.Operator.DEST_OVER);
  context.arc(16, 16, 16, 0, 2 * Math.PI);

  context.selectFontFace("Sans", Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL)
  context.setFontSize(40)

  context.moveTo(10, 50)
  context.showText("Disziplin ist Macht.")

  context.fill()

  /*   cairo_select_font_face(cr, "Sans", CAIRO_FONT_SLANT_NORMAL,
   *       CAIRO_FONT_WEIGHT_NORMAL);
   *   cairo_set_font_size(cr, 40.0);
   * 
   *   cairo_move_to(cr, 10.0, 50.0);
   *   cairo_show_text(cr, "Disziplin ist Macht."); */

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
