
const gi = require('../lib/index');
gi.startLoop()

const Gdk          = gi.require('Gdk', '3.0');
const Gtk          = gi.require('Gtk', '3.0');
const GtkSource    = gi.require('GtkSource', '3.0');

const Fs     = require('fs')
const Path   = require('path');
const ChildP = require('child_process');
const spawnSync = ChildP.spawnSync;

Gdk.init([])
Gtk.init()

const schemeManager = GtkSource.StyleSchemeManager.getDefault();
const langManager = GtkSource.LanguageManager.getDefault();
const scheme = schemeManager.getScheme('oblivion');

const css = new Gtk.CssProvider();
css.loadFromPath(Path.join(__dirname, 'style.css'));

const win = new Gtk.Window({
    title: 'Node-GTK Editor',
    type: Gtk.WindowType.TOPLEVEL,
    window_position: Gtk.WindowPosition.CENTER
});
win.setDefaultSize(600, 800);
win.on('show', Gtk.main);
win.on('destroy', Gtk.mainQuit);

const grid   = new Gtk.Grid();

const header = new Gtk.HeaderBar();
const label  = new Gtk.Label('label');
header.add(label);

const entryView = new Gtk.Entry();
entryView.setIconFromIconName(Gtk.EntryIconPosition.PRIMARY, 'application-exit-symbolic');
// entryView.getStyleContext().addProvider(css, 9999);
entryView.name = 'entry';

const scrollView = new Gtk.ScrolledWindow();
const textView   = new GtkSource.View();
scrollView.add(textView);

const btn = new Gtk.Button('yo');
header.add(btn);

const pop = new Gtk.Popover(btn);
pop.setSizeRequest(200, 100);
pop.setRelativeTo(btn);
// add(pop);

scrollView.margin = 10;

textView.vexpand = true;
textView.hexpand = true;
textView.monospace = true;
textView.showLineNumbers = true;
textView.highlightCurrentLine = true;
// textView.get_style_context().add_provider(css, 9999);

const buffer = textView.getBuffer();
buffer.highlightSyntax = true;
buffer.styleScheme = scheme;

grid.attach(header,     0, 0, 2, 1);
grid.attach(scrollView, 0, 1, 2, 1);
grid.attach(entryView,  0, 2, 2, 1);

win.add(grid);

function loadFile(filename) {
    try {
        const content = Fs.readFileSync(filename);
        const lang = langManager.guessLanguage(filename, null)
            || langManager.guessLanguage('file.js', null);
        label.setText(filename);

        buffer.language = lang;
        buffer.text = content
        buffer.filename = filename;

        textView.grabFocus();
    } catch (error) {
        console.error(error)
        buffer.language = null;
        buffer.text = error.toString()
    }
}

function saveFile(filename) {
    try {
        if (filename == null) {
            filename = buffer.filename;
        }
        let start = buffer.getStartIter();
        let end = buffer.getEndIter();
        const content = buffer.getText(start, end, false);
        Fs.writeFileSync(filename, content);
        return console.log(filename + ' written ' + content.length);
    } catch (error) {
        console.error(error);
    }
}

const resolvePath = function(file) {
    file = Path.resolve(__dirname, Path.normalize(file));
    if (Fs.fileExistsSync(file)) {
        return file;
    } else {
        return 'index.es';
    }
};

const safeEval = function(code) {
    try {
        return eval(code)
    } catch (error) {
        console.error(error);
    }
    return null;
};

const execute = function(command) {
    if (command.charAt(0) === '!') {
        return spawnSync(command.substring(1));
    }

    const tokens = command.split(' ');

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


textView.on('key-press-event', function(event) {
    const keyname = Gdk.keyvalName(event.keyval);
    const label = Gtk.acceleratorGetLabel(event.keyval, event.state);

    console.log(event, event.keyval, keyname, label)

    btn.label = label;

    if (keyname.match(/(semi)?colon/)) {
        entryView.grabFocus();
        return true;
    }
    if (event.keyval === Gdk.KEY_G) {
        buffer.placeCursor(buffer.getEndIter());
        return true;
    }
    if (event.keyval === Gdk.KEY_g) {
        let start = buffer.getStartIter()
        buffer.placeCursor(start)
        return true;
    }

    return false;
});

entryView.on('key-press-event', function(event) {
    btn.label = Gtk.acceleratorGetLabel(event.keyval, event.state);

    switch (event.keyval) {
        case Gdk.KEY_Escape: {
            textView.grabFocus();
            break;
        }
        case Gdk.KEY_Return: {
            let text = entryView.getText();
            entryView.setText('');
            execute(text);
            break;
        }
        default:
            return false;
    }
    return true;
});

btn.on('clicked', () => {
    if (pop.getVisible()) {
        return pop.hide();
    } else {
        return pop.showAll();
    }
})


loadFile(__filename)

win.showAll()
