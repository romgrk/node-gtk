const path   = require('path')
const gi = require('../lib')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gtk.init()

const gladeFile = path.join(__dirname, './builder-auto-connect-signals.glade')
const builder = Gtk.Builder.newFromFile(gladeFile)

const handlers = {
  onWindowShow: Gtk.main,
  onWindowDestroy: Gtk.mainQuit,
  onCloseBtnClicked: function () {
    win.close()
    console.log('window closed')
  },
  onActionBtnClicked: function () {
    console.log('button clicked')
  }
}

// Connect to signals that specified on glade file
builder.connectSignals(handlers)

const win = builder.getObject('mainWindow')
win.setDefaultSize(600, 400)

const label = builder.getObject('helloLabel')
label.setText('Hello World!')

win.showAll()
