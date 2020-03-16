/*
 * Gtk-3.0.js
 */

const gi = require('../../lib/index.js')
const GObject = gi.require('GObject')
const internal = require('../native.js')

// Types:     https://github.com/romgrk/node-gtk/blob/master/lib/overrides/GObject.js#L12-L35
// Functions: https://developer.gnome.org/gobject/stable/gobject-Standard-Parameter-and-Value-Types.html
const TYPE_FN = {
  [GObject.TYPE_STRING]: GObject.Value.prototype.setString,
  [GObject.TYPE_FLOAT]:  GObject.Value.prototype.setFloat,

  [GObject.TYPE_CHAR]: GObject.Value.prototype.setChar,
  [GObject.TYPE_UCHAR]: GObject.Value.prototype.setUChar,
  [GObject.TYPE_BOOLEAN]: GObject.Value.prototype.setBoolean,
  [GObject.TYPE_INT]: GObject.Value.prototype.setInt,
  [GObject.TYPE_UINT]: GObject.Value.prototype.setUInt,
  [GObject.TYPE_LONG]: GObject.Value.prototype.setLong,
  [GObject.TYPE_ULONG]: GObject.Value.prototype.setULong,
  [GObject.TYPE_INT64]: GObject.Value.prototype.setInt64,
  [GObject.TYPE_UINT64]: GObject.Value.prototype.setUInt64,
  [GObject.TYPE_ENUM]: GObject.Value.prototype.setEnum,
  [GObject.TYPE_FLAGS]: GObject.Value.prototype.setFlags,
  [GObject.TYPE_FLOAT]: GObject.Value.prototype.setFloat,
  [GObject.TYPE_DOUBLE]: GObject.Value.prototype.setDouble,
  [GObject.TYPE_STRING]: GObject.Value.prototype.setString,
  [GObject.TYPE_POINTER]: GObject.Value.prototype.setPointer,
  [GObject.TYPE_BOXED]: GObject.Value.prototype.setBoxed,
  [GObject.TYPE_PARAM]: GObject.Value.prototype.setParam,
  [GObject.TYPE_OBJECT]: GObject.Value.prototype.setObject,
  [GObject.TYPE_GTYPE]: GObject.Value.prototype.setGtype,
  [GObject.TYPE_VARIANT]: GObject.Value.prototype.setVariant,
  [GObject.TYPE_UNICHAR]: GObject.Value.prototype.setUChar,
}

/**
 * @typedef {Object} Dimension
 * @property {number} width
 * @property {number} height
 */

exports.apply = (Gtk) => {

    /*
     * main loop functions
     */
    {

      const originalMain = Gtk.main
      const originalQuit = Gtk.mainQuit

      let placeholderIntervalID
      let userCallingQuit = false

      Gtk.main = function main() {
          const loopStack = internal.GetLoopStack()

          /*
           * To keep the nodejs event loop alive, we need to have something running.
           */
          if (placeholderIntervalID === undefined) {
            placeholderIntervalID = setInterval(() => { /* noop */ }, 60 * 60 * 1000)
          }

          loopStack.push(originalQuit)

          originalMain()

          if (userCallingQuit) {
            loopStack.pop()
          }

          userCallingQuit = false

          if (Gtk.mainLevel() === 0) {
            placeholderIntervalID = clearInterval(placeholderIntervalID)
          }
      }

      Gtk.mainQuit = function mainQuit() {
          if (Gtk.mainLevel() === 0)
            return
          userCallingQuit = true
          originalQuit()
      }

    }


  /*
   * Gtk.Widget
   */

  /**
   * Gtk.Widget.prototype.getSizeRequest
   * @returns {Dimension}
   */
  const getSizeRequest = Gtk.Widget.prototype.getSizeRequest
  Gtk.Widget.prototype.getSizeRequest = function() {
    const [width, height] = getSizeRequest.call(this)
    return { width, height }
  }


  /*
   * Gtk.Builder
   */

  /**
   * Gtk.Builder.prototype.getObject
   * @returns {GObject}
   */
  const getObject = Gtk.Builder.prototype.getObject
  Gtk.Builder.prototype.getObject = function(name) {
    const object = getObject.call(this, name)
    const typeName = GObject.typeName(object.__gtype__)

    if (typeName.startsWith('Gtk')) {
      const klass = Gtk[typeName.replace(/^Gtk/, '')]

      if (klass) {
        object.__proto__ = klass.prototype
      }
    }

    return object
  }

  /**
   * Gtk.Builder.prototype.connectSignals
   * @returns void
   */
  Gtk.Builder.prototype.connectSignals = function(handlers) {
    if (!handlers) return
    this.connectSignalsFull(function (builder, object, signal, handler) {
      if (handlers[handler] && typeof handlers[handler] == 'function') {
        object.connect(signal, handlers[handler])
      }
    })
  }

  /* Gtk.Store */

  function appendRow(row, types) {
    const iter = this.append()

    for (let i = 0; i < row.length; i++) {
      const item = row[i]
      const type = types[i]
      const typeFn = TYPE_FN[type] || TYPE_FN[GObject.TYPE_OBJECT]
      const value = new GObject.Value()
      value.init(type)
      typeFn.call(value, item)
      this.setValue(iter, i, value)
    }
  }

  Gtk.ListStore.prototype.appendRow = appendRow
  Gtk.TreeStore.prototype.appendRow = appendRow

  /* Gtk.TreeView */

  const originalAppendColumn = Gtk.TreeView.prototype.appendColumn
  Gtk.TreeView.prototype.appendColumn = function appendColumn(column) {
    if (column instanceof Gtk.TreeViewColumn) {
      originalAppendColumn.call(this, column)
      return
    }

    const { type, title } = column
    let instance
    switch(type) {
      case 'text':     instance = createTextColumn(this, column); break;
      case 'pixbuf':   instance = createPixbufColumn(this, column); break;
      case 'progress': instance = createProgressColumn(this, column); break;
      case 'spinner':  instance = createSpinnerColumn(this, column); break;
      case 'toggle':   instance = createToggleColumn(this, column); break;
      default:
        throw new Error(`Unrecognized column type: ${type}`)
    }

    originalAppendColumn.call(this, instance)
  }

  function createTextColumn(view, { title }) {
    const model = view.getModel()
    const column = new Gtk.TreeViewColumn({ title })
    const renderer = new Gtk.CellRendererText()

    column.packStart(renderer, true)
    column.addAttribute(renderer,  'text', view.getNColumns())

    return column
  }

  function createPixbufColumn(view, { title }) {
    const model = view.getModel()
    const column = new Gtk.TreeViewColumn({ title })
    const renderer = new Gtk.CellRendererPixbuf()

    column.packStart(renderer, true)
    column.addAttribute(renderer,  'pixbuf', view.getNColumns())

    return column
  }

  function createProgressColumn(view, { title }) {
    const model = view.getModel()
    const column = new Gtk.TreeViewColumn({ title })
    const renderer = new Gtk.CellRendererProgress()

    column.packStart(renderer, true)
    column.addAttribute(renderer,  'value', view.getNColumns())

    return column
  }

  function createSpinnerColumn(view, { title }) {
    const model = view.getModel()
    const column = new Gtk.TreeViewColumn({ title })
    const renderer = new Gtk.CellRendererSpinner()

    column.packStart(renderer, true)
    column.addAttribute(renderer,  'active', view.getNColumns())

    return column
  }

  function createToggleColumn(view, { title }) {
    const model = view.getModel()
    const column = new Gtk.TreeViewColumn({ title })
    const renderer = new Gtk.CellRendererToggle()

    column.packStart(renderer, true)
    column.addAttribute(renderer,  'active', view.getNColumns())

    return column
  }
}
