# !::coffee [.]

Util = require 'util'
Fs   = require 'fs-plus'
Path = require 'path'

GI = require '../lib/index'
GI.startLoop()

Gdk       = GI.importNS 'Gdk', '3.0'
Gtk       = GI.importNS 'Gtk', '3.0'
GtkSource = GI.importNS 'GtkSource', '3.0'
Vte       = GI.importNS 'Vte'
#Terminal = require './terminal'

Gtk.init null

Orientation  = Gtk.Orientation
StyleContext = Gtk.StyleContext
CssProvider  = Gtk.CssProvider

schemeManager = GtkSource.StyleSchemeManager.get_default()
langManager   = GtkSource.LanguageManager.get_default()
scheme        = schemeManager.get_scheme("builder-dark")

css = new CssProvider
css.load_from_path Path.join __dirname, 'style.css'

win = new Gtk.Window
    title:           'node-gtk'
    type:            Gtk.WindowType.TOPLEVEL
    window_position: Gtk.WindowPosition.CENTER
win.set_default_size 600, 400
#win.set_decorated false
#win.set_resizable false
win.connect 'show',    Gtk.main
win.connect 'destroy', Gtk.main_quit

#box      = new Gtk.Box Orientation.HORIZONTAL
grid     = new Gtk.Grid

header = new Gtk.HeaderBar
label  = new Gtk.Label 'label'
header.add label

entryView   = new Gtk.Entry
entryView.set_icon_from_icon_name Gtk.EntryIconPosition.PRIMARY, 'application-exit-symbolic'
entryView.get_style_context().add_provider css, 9999
entryView.name = 'entry'

scrollView = new Gtk.ScrolledWindow
textView   = new GtkSource.View
scrollView.add textView

btn = new Gtk.Button("yo")
header.add btn

pop = new Gtk.Popover(btn)
pop.add new Gtk.Label("yo")
pop.set_size_request(50, 100)

scrollView.margin  = 10

textView.vexpand                = true
textView.hexpand                = true
textView.monospace              = true
textView.show_line_numbers      = true
textView.highlight_current_line = true
textView.get_style_context().add_provider css, 9999

buffer = textView.get_buffer()
buffer.set_highlight_syntax true
buffer.set_style_scheme     scheme

#termView   = new Vte.Terminal

#grid.attach             x, y, w, h
grid.attach header,      0, 0, 2, 1
grid.attach scrollView,  0, 1, 2, 1
#grid.attach termView,    1, 1, 1, 1
grid.attach entryView,   0, 2, 2, 1
win.add grid

# File loading
loadFile = (filename) ->
    try
        content = Fs.readFileSync(filename)
        lang = langManager.guess_language filename, null
        label.set_text filename
        buffer.set_language lang
        buffer.set_text(content, -1)
        buffer.filename = filename
        textView.grab_focus()
    catch err
        buffer.set_language null
        buffer.set_text(err.toString(), -1)

saveFile = (filename) ->
    try
        filename = buffer.filename unless filename?

        start = buffer.get_start_iter()
        end   = buffer.get_end_iter()
        content = buffer.get_text(start, end, false)

        #console.log content
        Fs.writeFileSync(filename, content)
        console.log "#{filename} written #{content.length}"
    catch err
        console.error err

resolvePath = (file) ->
    Path.resolve(__dirname, Fs.normalize(file))

# Code execution
safeEval = (code) ->
    try
        res = eval(code)
        return res
    catch err
        console.error err
    return null

# Command execution
execute = (command) ->
    tokens = command.split(' ')
    if tokens[0] == 'e'
        if tokens.length > 1
            loadFile(resolvePath(tokens[1]))
        else if buf.filename?
            loadFile(buf.filename)
        else
         console.log('No filename')
    else if tokens[0] == 'w'
        if tokens.length > 1
            saveFile(resolvePath(tokens[1]))
        else
            saveFile()
    else if tokens[0] == 'q'
        win.close()
        process.exit()
    else if tokens[0] == 'pop'
        pop.show_all()
    else
        console.log command, ' => ', safeEval(command)

# Event handling
textView.connect 'key-press-event', (widget, event) ->
    key = event.keyval
    keyname = Gdk.keyval_name(key)
    console.log 'KeyPress: ', Gtk.accelerator_get_label(event.keyval, event.state)

    if keyname.match /(semi)?colon/
        entryView.grab_focus()
        return true

    if key == Gdk.KEY_G
        buffer.place_cursor buffer.get_end_iter()
        return true

    if key == Gdk.KEY_g
        start = buffer.get_start_iter()
        buffer.place_cursor start
        return true

    return false

entryView.history = ['buf.get_start_iter()']
entryView.connect 'key-press-event', (widget, event) ->
    keyname = Gdk.keyval_name(event.keyval)
    console.log 'CmdPress: ', Gtk.accelerator_get_label(event.keyval, event.state)
    if event.keyval == Gdk.KEY_Tab
        entryView.set_text(entryView.history[0])
        return true
    else if keyname == 'Escape'
        textView.grab_focus()
    else if keyname == 'Return'
        text = entryView.get_text()
        entryView.set_text('')
        entryView.history.unshift text
        execute text

btn.connect 'clicked', () ->
    if pop.get_visible()
        pop.hide()
    else
        pop.show_all()


# UI loop start

buf = buffer

loadFile Path.join(__dirname, 'index.coffee')

win.show_all()
