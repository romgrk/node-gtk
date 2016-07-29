'use strict';
// ::exe [silent !traceur --modules commonjs --source-maps inline --out %<js % ]

var btn, buf , buffer,
    entryView, grid,
    header, label,
    pop,
    scrollView, textView;

const GI = require('../lib/index');
GI.startLoop();

global.Gir          = GI.require('GIRepository');
global.GLib         = GI.require('GLib');
global.Gio          = GI.require('Gio');
global.Gdk          = GI.require('Gdk', '3.0');
global.Gtk          = GI.require('Gtk', '3.0');
global.GtkSource    = GI.require('GtkSource', '3.0');
global.Vte          = GI.require('Vte');
const Orientation  = Gtk.Orientation;
const StyleContext = Gtk.StyleContext;
const CssProvider  = Gtk.CssProvider;

const Fs     = require('/home/romgrk/node_modules/fs-plus')
const Path   = require('path');
const Util   = require('util');
const ChildP = require('child_process');
const spawnSync = ChildP.spawnSync;

Gtk.init(null, 0);

const schemeManager = GtkSource.StyleSchemeManager.getDefault();
const langManager = GtkSource.LanguageManager.getDefault();
const scheme = schemeManager.getScheme("builder-dark");

var css = new Gtk.CssProvider();
css.loadFromPath(Path.join(__dirname, 'style.css'));

var win = new Gtk.Window({
    title: 'node-gtk',
    type: Gtk.WindowType.TOPLEVEL,
    window_position: Gtk.WindowPosition.CENTER
});

win.setDefaultSize(600, 800);
win.on('show', Gtk.main);
win.on('destroy', Gtk.main_quit);

grid   = new Gtk.Grid();

header = new Gtk.HeaderBar();
label  = new Gtk.Label('label');
header.add(label);

entryView = new Gtk.Entry();
entryView.setIconFromIconName(Gtk.EntryIconPosition.PRIMARY, 'application-exit-symbolic');
//entryView.getStyleContext().addProvider(css, 9999);
entryView.name = 'entry';

scrollView = new Gtk.ScrolledWindow();
textView   = new GtkSource.View();
scrollView.add(textView);

btn = new Gtk.Button("yo");
header.add(btn);

pop = new Gtk.Popover(btn);
pop.setSizeRequest(200, 100);
pop.setRelativeTo(btn);
//add(pop);

scrollView.margin = 10;

textView.vexpand = true;
textView.hexpand = true;
textView.monospace = true;
textView.show_line_numbers = true;
textView.highlight_current_line = true;
//textView.get_style_context().add_provider(css, 9999);

buffer = textView.getBuffer();
buffer.setHighlightSyntax(true);
buffer.setStyleScheme(scheme);

grid.attach(header, 0, 0, 2, 1);
grid.attach(scrollView, 0, 1, 2, 1);
grid.attach(entryView, 0, 2, 2, 1);

win.add(grid);

const loadFile = function(filename) {
    var content, err, error, lang;
    try {
        content = Fs.readFileSync(filename);
        lang = langManager.guessLanguage(filename, null);
        if (lang == null)
            lang = langManager.guessLanguage('file.js', null);
        label.setText(filename);
        buffer.setLanguage(lang);
        buffer.setText(content, -1);
        buffer.filename = filename;
        return textView.grabFocus();
    } catch (error) {
        err = error;
        buffer.setLanguage(null);
        return buffer.setText(err.toString(), -1);
    }
};

const saveFile = function(filename) {
    var content, error;
    try {
        if (filename == null) {
            filename = buffer.filename;
        }
        let start = buffer.getStartIter();
        let end = buffer.getEndIter();
        content = buffer.getText(start, end, false);
        Fs.writeFileSync(filename, content);
        return console.log(filename + " written " + content.length);
    } catch (error) {
        console.error(error);
    }
};

const resolvePath = function(file) {
    file = Path.resolve(__dirname, Fs.normalize(file));
    if (Fs.fileExistsSync(file)) {
        return file;
    } else {
        return '/home/romgrk/coffeelint.json';
    }
};

const safeEval = function(code) {
    var err, error, res;
    try {
        res = eval(code);
        return res;
    } catch (error) {
        err = error;
        console.error(err);
    }
    return null;
};

const execute = function(command) {
    var tokens;
    if (command.charAt(0) === '!') {
        return spawnSync(command.substring(1));
    }

    tokens = command.split(' ');

    if (tokens[0] === 'e') {
        if (tokens.length > 1) {
            return loadFile((tokens[1]));
        } else if (buffer.filename != null) {
            return loadFile(buffer.filename);
        } else {
            return console.log('No filename');
        }
    } else if (tokens[0] === 'w') {
        if (tokens.length > 1) {
            return saveFile(resolvePath(tokens[1]));
        } else {
            return saveFile();
        }
    } else if (tokens[0] === 'q') {
        win.close();
        return process.exit();
    } else if (tokens[0] === 'pop') {
        return pop.showAll();
    } else {
        return console.log(command, ' => ', safeEval(command));
    }
};


textView.connect('key-press-event', function(widget, event) {
    event.__proto__ = Gdk.EventKey.prototype;
    console.log(event.type, event.keyval);
    let key = event.keyval;
    let keyname = Gdk.keyval_name(event.keyval);
    let label = Gtk.accelerator_get_label(event.keyval, event.state);
    console.log(keyname, label);
    btn.label = label;

    //console.log('KeyPress: ', );
    if (keyname.match(/(semi)?colon/)) {
        entryView.grabFocus();
        return true;
    }
    if (key === Gdk.KEY_G) {
        buffer.placeCursor(buffer.getEndIter());
        return true;
    }
    if (key === Gdk.KEY_g) {
        let start = buffer.getStartIter();
        buffer.placeCursor(start);
        return true;
    }
    return false;
});

entryView.history = ['pop.get_children()'];
entryView.connect('key-press-event', function(widget, event) {
    event.__proto__ = Gdk.EventKey.prototype;
    let key = event.keyval;
    let keyname = Gdk.keyval_name(key);
    btn.label = Gtk.accelerator_get_label(event.keyval, event.state);
    switch (key) {
        case Gdk.KEY_Tab:
            entryView.setText(entryView.history[0]);
            break;
        case Gdk.KEY_Escape:
            textView.grabFocus();
            break;
        case Gdk.KEY_Return:
            let text = entryView.getText();
            entryView.setText('');
            entryView.history.unshift(text);
            execute(text);
            break;
        default:
            return false;
    }
    return true;
});

btn.connect('clicked', () => {
    if (pop.getVisible()) {
        return pop.hide();
    } else {
        return pop.showAll();
    }
});


loadFile(Path.join(__dirname, 'index.es'));

win.showAll();
