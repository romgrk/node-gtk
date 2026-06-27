/*
 * gtk4-vfunc-debug.mjs
 *
 * Run with:  node --import node-gtk/register examples/gtk4-vfunc-debug.mjs
 */

import { registerClass } from "node-gtk";
import GLib from "gi:GLib-2.0";
import Gtk from "gi:Gtk-4.0";

Gtk.init();

class CustomFixedLayout extends Gtk.FixedLayout {
  static GTypeName = "CustomFixedLayout";

  measure(widget, orientation, forSize) {
    console.log("measure");
    return super.measure(widget, orientation, forSize);
  }
}

class CustomFixed extends Gtk.Fixed {
  static GTypeName = "CustomFixed";

  constructor() {
    super();
    this.setLayoutManager(new CustomFixedLayout());
  }
}

registerClass(CustomFixedLayout);
registerClass(CustomFixed);

console.log(Gtk.FixedLayout.prototype.measure)
console.log(Gtk.FixedLayout.prototype.measure.toString())
process.exit(0)

/* Setup & start the application */

const loop = GLib.MainLoop.new(null, false);
const app = new Gtk.Application("com.github.romgrk.node-gtk.demo", 0);
app.on("activate", onActivate);
app.run();

function onActivate() {
  const window = new Gtk.ApplicationWindow(app);
  window.on("close-request", onQuit);

  const cssProvider = new Gtk.CssProvider();
  const customFixedCss = `
  #custom-fixed {
    background-color: red;
  }
`;

  const customFixed = new CustomFixed();
  customFixed.setName("custom-fixed");
  cssProvider.loadFromData(customFixedCss, customFixedCss.length);
  customFixed
    .getStyleContext()
    .addProvider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_USER);

  window.setChild(customFixed);
  window.present();

  loop.run();
}

function onQuit() {
  loop.quit();
  app.quit();
  return false;
}
