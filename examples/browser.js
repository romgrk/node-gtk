#!/usr/bin/env node
/*
 * A basic node-gtk Webkit based browser example.
 * Similar logic and basic interface found in this PyGTK example:
 * http://www.eurion.net/python-snippets/snippet/Webkit%20Browser.html
 */

const gi = require('../lib/')

const Gtk     = gi.require('Gtk', '3.0')
const WebKit2 = gi.require('WebKit2')

// Start the GLib event loop
gi.startLoop()

// Necessary to initialize the graphic environment.
// If this fails it means the host cannot show Gtk-3.0
Gtk.init()

// Main program window
const window = new Gtk.Window({
  type : Gtk.WindowType.TOPLEVEL
})

// WebKit2 browser wrapper
const webView = new WebKit2.WebView()

// Toolbar with buttons
const toolbar = new Gtk.Toolbar()

// Buttons to go back, go forward, or refresh
const button = {
  back:    Gtk.ToolButton.newFromStock(Gtk.STOCK_GO_BACK),
  forward: Gtk.ToolButton.newFromStock(Gtk.STOCK_GO_FORWARD),
  refresh: Gtk.ToolButton.newFromStock(Gtk.STOCK_REFRESH),
}

// where the URL is written and shown
const urlBar = new Gtk.Entry()

// the browser container, so that it is scrollable
const scrollWindow = new Gtk.ScrolledWindow({})

// horizontal and vertical boxes
const hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
const vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })


/*
 * Build our layout
 */

scrollWindow.add(webView)

toolbar.add(button.back)
toolbar.add(button.forward)
toolbar.add(button.refresh)

// Gtk.Box.prototype
//  .packStart(children: Gtk.Widget, expand: boolean, fill: boolean, padding: number): void

// pack horizontally toolbar and url bar
hbox.packStart(toolbar, false, false, 0)
hbox.packStart(urlBar,  true,  true,  8)

// pack vertically top bar (hbox) and scrollable window
vbox.packStart(hbox,         false, true, 0)
vbox.packStart(scrollWindow, true,  true, 0)

// configure main window
window.setDefaultSize(1024, 720)
window.setResizable(true)
window.add(vbox)



/*
 * Settings
 */

// Setting up optional Dark theme (gotta love it!)
if (process.argv.some(color => color === 'dark')) {
  let gtkSettings = Gtk.Settings.getDefault()
  gtkSettings.gtkApplicationPreferDarkTheme = true
  gtkSettings.gtkThemeName = 'Adwaita'
}

{
  // Update some webview settings
  const webSettings = webView.getSettings()
  webSettings.enableDeveloperExtras = true
  webSettings.enableCaretBrowsing = true
  console.log('webSettings: ', webSettings)
}



/*
 * Event handlers
 */

// whenever a new page is loaded ...
webView.on('load-changed', (loadEvent) => {
  switch (loadEvent) {
    case WebKit2.LoadEvent.COMMITTED:
      // Update the URL bar with the current adress
      urlBar.setText(webView.getUri())
      button.back.setSensitive(webView.canGoBack())
      button.forward.setSensitive(webView.canGoForward())
      break
  }
})

// configure buttons actions
button.back.on('clicked',    webView.goBack)
button.forward.on('clicked', webView.goForward)
button.refresh.on('clicked', webView.reload)

// define "enter" / call-to-action event (whenever the url changes on the bar)
urlBar.on('activate', () => {
  let href = url(urlBar.getText())
  urlBar.setText(href)
  webView.loadUri(href)
})

// window show event
window.on('show', () => {
  // bring it on top in OSX
  // window.setKeepAbove(true)

  // This start the Gtk event loop. It is required to process user events.
  // It doesn't return until you don't need Gtk anymore, usually on window close.
  Gtk.main()
})

// window after-close event
window.on('destroy', () => Gtk.mainQuit())

// window close event: returning true has the semantic of preventing the default behavior:
// in this case, it would prevent the user from closing the window if we would return `true`
window.on('delete-event', () => false)



/*
 * Main
 */

main()

function main() {
  // open first argument or Google
  webView.loadUri(url(process.argv[2] || 'google.com'))

  // add vertical ui and show them all
  window.showAll()
}


/*
 * Helpers
 */

// if link doesn't have a protocol, prefixes it via http://
function url(href) {
  return /^([a-z]{2,}):/.test(href) ? href : ('http://' + href)
}
