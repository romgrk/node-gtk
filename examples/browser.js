#!/usr/bin/env node

// A basic node-gtk Webkit based browser example.
// Similar logic and basic interface found in this PyGTK example:
// http://www.eurion.net/python-snippets/snippet/Webkit%20Browser.html

var ngtk = require('../lib/');
ngtk.startLoop();

(function (Gtk, WebKit2) {'use strict';

  // necessary to initialize the graphic environment
  // if this fails it means the host cannot show GTK3
  Gtk.init(null);

  const
    // main program window
    window = new Gtk.Window({
      type : Gtk.WindowType.TOPLEVEL
    }),
    // the WebKit2 browser wrapper
    webView = new WebKit2.WebView(),

    webSettings = webView.getSettings(),
    // toolbar with buttons
    toolbar = new Gtk.Toolbar(),
    // buttons to go back, go forward, or refresh
    button = {
      back: Gtk.ToolButton.newFromStock(Gtk.STOCK_GO_BACK),
      forward: Gtk.ToolButton.newFromStock(Gtk.STOCK_GO_FORWARD),
      refresh: Gtk.ToolButton.newFromStock(Gtk.STOCK_REFRESH)
    },
    // where the URL is written and shown
    urlBar = new Gtk.Entry(),
    // the browser container, so that's scrollable
    scrollWindow = new Gtk.ScrolledWindow({}),
    // horizontal and vertical boxes
    hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL}),
    vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL})
  ;

  // Setting up optional Dark theme (gotta love it!)
  // ./browser.js google.com dark
  if (process.argv.some(color => color === 'dark')) {
    let gtkSettings = Gtk.Settings.getDefault();
    // gtkSettings.gtkApplicationPreferDarkTheme = true;
    // gtkSettings.gtkThemeName = 'Adwaita';
  }
  webSettings.enableDeveloperExtras = true;
  webSettings.enableCaretBrowsing = true;
  console.log('webSettings: ', webSettings);

  // open first argument or Google
  webView.loadUri(url(process.argv[2] || 'google.com'));

  // whenever a new page is loaded ...
  webView.connect('load-changed', (widget, load_event, data) => {
    switch (load_event) {
      case 2: // XXX: where is WEBKIT_LOAD_COMMITTED ?
        // ... update the URL bar with the current adress
        urlBar.setText(widget.getUri());
        button.back.setSensitive(webView.canGoBack());
        button.forward.setSensitive(webView.canGoForward());
        break;
    }
  });

  // configure buttons actions
  button.back.connect('clicked', () => webView.goBack());
  button.forward.connect('clicked', () => webView.goForward());
  button.refresh.connect('clicked', () => webView.reload());

  // enrich the toolbar
  toolbar.add(button.back);
  toolbar.add(button.forward);
  toolbar.add(button.refresh);

  // define "enter" / call-to-action event
  // whenever the url changes on the bar
  urlBar.connect('activate', () => {
    let href = url(urlBar.getText());
    urlBar.setText(href);
    webView.loadUri(href);
  });

  // make the container scrollable
  scrollWindow.add(webView);

  // pack horizontally toolbar and url bar
  hbox.packStart(toolbar, false, false, 0);
  hbox.packStart(urlBar, true, true, 8);

  // pack vertically top bar (hbox) and scrollable window
  vbox.packStart(hbox, false, true, 0);
  vbox.packStart(scrollWindow, true, true, 0);

  // configure main window
  window.setDefaultSize(1024, 720);
  window.setResizable(true);
  window.connect('show', () => {
    // bring it on top in OSX
    // window.setKeepAbove(true);
    Gtk.main()
  });
  window.connect('destroy', () => Gtk.main_quit());
  window.connect('delete_event', () => false);

  // add vertical ui and show them all
  window.add(vbox);
  window.showAll();

  // little helper
  // if link doesn't have a protocol, prefixes it via http://
  function url(href) {
    return /^([a-z]{2,}):/.test(href) ? href : ('http://' + href);
  }

}(
  ngtk.importNS('Gtk', '3.0'),
  ngtk.importNS('WebKit2')
));
