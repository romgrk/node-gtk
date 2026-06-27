/*
 * A basic node-gtk WebKit based browser example, built with libadwaita (GTK 4).
 *
 * Run with:  node --import node-gtk/register examples/browser.mjs [url] [dark]
 */

import { startLoop } from 'node-gtk'
import GLib from 'gi:GLib-2.0'
import Gtk from 'gi:Gtk-4.0'
import Adw from 'gi:Adw-1'
import WebKit from 'gi:WebKit-6.0'

const loop = GLib.MainLoop.new(null, false)
const app = new Adw.Application('com.github.romgrk.node-gtk.browser', 0)

app.on('activate', onActivate)
startLoop()
app.run([])

function onActivate() {
  // Optional dark theme (gotta love it!)
  if (process.argv.some(arg => arg === 'dark'))
    Adw.StyleManager.getDefault().setColorScheme(Adw.ColorScheme.FORCE_DARK)

  const window = new Adw.ApplicationWindow(app)
  window.setTitle('node-gtk Browser')
  window.setDefaultSize(1024, 720)
  window.on('close-request', onQuit)

  // WebKit2 browser wrapper. It scrolls internally, so no ScrolledWindow needed.
  const webView = new WebKit.WebView({ vexpand: true, hexpand: true })

  const settings = webView.getSettings()
  settings.setEnableDeveloperExtras(true)

  // Navigation buttons, grouped with the "linked" style so they read as a unit.
  const backButton    = new Gtk.Button({ 'icon-name': 'go-previous-symbolic', sensitive: false })
  const forwardButton = new Gtk.Button({ 'icon-name': 'go-next-symbolic', sensitive: false })
  const navBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
  navBox.addCssClass('linked')
  navBox.append(backButton)
  navBox.append(forwardButton)

  const refreshButton = new Gtk.Button({ 'icon-name': 'view-refresh-symbolic' })

  // The URL bar lives in the header bar's title slot and doubles as a
  // progress indicator while a page loads.
  const urlBar = new Gtk.Entry({ hexpand: true })
  urlBar.setInputPurpose(Gtk.InputPurpose.URL)

  const header = new Adw.HeaderBar()
  header.packStart(navBox)
  header.packStart(refreshButton)
  header.setTitleWidget(urlBar)

  // ToolbarView is the canonical Adwaita way to stack a header bar over content.
  const view = new Adw.ToolbarView()
  view.addTopBar(header)
  view.setContent(webView)
  window.setContent(view)

  /*
   * Event handlers
   */

  webView.on('load-changed', (loadEvent) => {
    if (loadEvent === WebKit.LoadEvent.COMMITTED)
      urlBar.setText(webView.getUri() || '')
    backButton.setSensitive(webView.canGoBack())
    forwardButton.setSensitive(webView.canGoForward())
  })

  // Drive the entry's progress bar from the load estimate; clear it when done.
  webView.on('notify::estimated-load-progress', () => {
    const progress = webView.getEstimatedLoadProgress()
    urlBar.setProgressFraction(progress < 1 ? progress : 0)
  })

  webView.on('notify::title', () => {
    window.setTitle(webView.getTitle() || 'node-gtk Browser')
  })

  backButton.on('clicked',    () => webView.goBack())
  forwardButton.on('clicked', () => webView.goForward())
  refreshButton.on('clicked', () => webView.reload())

  urlBar.on('activate', () => {
    const href = url(urlBar.getText())
    urlBar.setText(href)
    webView.loadUri(href)
  })

  // Open the first non-flag argument, or Google by default.
  const urlArg = process.argv.slice(2).find(arg => arg !== 'dark')
  webView.loadUri(url(urlArg || 'google.com'))

  window.present()
  loop.run()
}

function onQuit() {
  loop.quit()
  app.quit()
  return false
}

/*
 * Helpers
 */

// If the link doesn't have a protocol, prefix it with http://
function url(href) {
  return /^([a-z]{2,}):/.test(href) ? href : ('http://' + href)
}
