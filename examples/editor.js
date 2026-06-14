/*
 * A small source-code editor built with GtkSourceView 5, GTK 4 and Adwaita.
 *
 * Features:
 *   - Syntax highlighting with language auto-detection
 *   - Adwaita light/dark style schemes that follow the system preference,
 *     plus a toolbar toggle to force dark mode
 *   - Open / Save / Save-As via the native Gtk.FileDialog
 *   - A source-map (minimap) gutter on the right
 *   - Keyboard shortcuts: Ctrl+O open, Ctrl+S save, Ctrl+Shift+S save-as,
 *     Ctrl+Q quit
 *
 * Run with:  node examples/editor.js [file]
 */

const gi = require('../lib/');
const GLib = gi.require('GLib', '2.0');
const Gio = gi.require('Gio', '2.0');
const Gtk = gi.require('Gtk', '4.0');
const Adw = gi.require('Adw', '1');
const GtkSource = gi.require('GtkSource', '5');

const Fs = require('fs');
const Path = require('path');

const loop = GLib.MainLoop.new(null, false);
const app = new Adw.Application('com.github.romgrk.node-gtk.editor', 0);

app.on('activate', () => {
  const schemeManager = GtkSource.StyleSchemeManager.getDefault();
  const langManager = GtkSource.LanguageManager.getDefault();
  const styleManager = Adw.StyleManager.getDefault();

  let currentFile = null;

  // --- Source view & buffer ------------------------------------------------

  const buffer = new GtkSource.Buffer();
  buffer.setHighlightSyntax(true);

  const view = new GtkSource.View({ buffer });
  view.setMonospace(true);
  view.setShowLineNumbers(true);
  view.setHighlightCurrentLine(true);
  view.setAutoIndent(true);
  view.setTabWidth(4);
  view.setShowRightMargin(true);
  view.setRightMarginPosition(80);
  view.setVexpand(true);
  view.setHexpand(true);

  const scrolled = new Gtk.ScrolledWindow();
  scrolled.setChild(view);
  scrolled.setHexpand(true);

  // The minimap mirrors the view and doubles as a scrollbar.
  const minimap = new GtkSource.Map();
  minimap.setView(view);

  const editorBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
  editorBox.append(scrolled);
  editorBox.append(minimap);

  // --- Style scheme: follow the system light/dark preference ---------------

  function applyScheme() {
    const id = styleManager.getDark() ? 'Adwaita-dark' : 'Adwaita';
    buffer.setStyleScheme(schemeManager.getScheme(id));
  }
  applyScheme();
  styleManager.on('notify::dark', applyScheme);

  // --- File operations -----------------------------------------------------

  function setTitle(title) {
    windowTitle.setTitle(title);
    windowTitle.setSubtitle(currentFile ? Path.dirname(currentFile) : '');
  }

  function loadFile(path) {
    try {
      const content = Fs.readFileSync(path, 'utf8');
      buffer.setLanguage(langManager.guessLanguage(path, null));
      buffer.setText(content, -1);
      buffer.placeCursor(buffer.getStartIter());
      currentFile = path;
      setTitle(Path.basename(path));
      view.grabFocus();
    } catch (error) {
      toast(`Could not open ${Path.basename(path)}: ${error.message}`);
    }
  }

  function saveTo(path) {
    const start = buffer.getStartIter();
    const end = buffer.getEndIter();
    const content = buffer.getText(start, end, false);
    try {
      Fs.writeFileSync(path, content);
      currentFile = path;
      setTitle(Path.basename(path));
      toast(`Saved ${Path.basename(path)}`);
    } catch (error) {
      toast(`Could not save: ${error.message}`);
    }
  }

  function openDialog() {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle('Open File');
    dialog.open(window, null, (self, result) => {
      try {
        const file = self.openFinish(result);
        if (file)
          loadFile(file.getPath());
      } catch (error) {
        // The user dismissed the dialog; nothing to do.
      }
    });
  }

  function saveAsDialog() {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle('Save File As');
    if (currentFile)
      dialog.setInitialName(Path.basename(currentFile));
    dialog.save(window, null, (self, result) => {
      try {
        const file = self.saveFinish(result);
        if (file)
          saveTo(file.getPath());
      } catch (error) {
        // Cancelled.
      }
    });
  }

  // --- Vim modal editing (GtkSource.VimIMContext) --------------------------

  // VimIMContext is a Gtk.IMContext that turns the view into a modal (vim)
  // editor. It must be driven by a key controller in the CAPTURE phase so it
  // sees keystrokes before the view inserts them as text.
  const vim = new GtkSource.VimIMContext();
  vim.setClientWidget(view);

  const vimKeys = new Gtk.EventControllerKey();
  vimKeys.setImContext(vim);
  vimKeys.setPropagationPhase(Gtk.PropagationPhase.CAPTURE);
  view.addController(vimKeys);

  // `:e [path]` — open a file, or reload the current one when path is empty.
  vim.on('edit', (_view, path) => loadFile(path || currentFile));
  // `:w [path]` — save to the given path, or the current file.
  vim.on('write', (_view, path) => saveTo(path || currentFile));
  // Catch-all for ex commands; we only need to implement quit.
  vim.on('execute-command', (command) => {
    if (/^\s*(wq|x|q)a?!?\s*$/.test(command)) {
      loop.quit();
      app.quit();
      return true;
    }
    return false;
  });

  // --- Actions & keyboard shortcuts ----------------------------------------

  function addAction(name, accel, callback) {
    const action = Gio.SimpleAction.new(name, null);
    action.on('activate', callback);
    app.addAction(action);
    app.setAccelsForAction(`app.${name}`, [accel]);
  }

  addAction('open', '<Control>o', openDialog);
  addAction('save', '<Control>s', () =>
    currentFile ? saveTo(currentFile) : saveAsDialog());
  addAction('save-as', '<Control><Shift>s', saveAsDialog);
  addAction('quit', '<Control>q', () => (loop.quit(), app.quit()));

  // --- Header bar ----------------------------------------------------------

  const windowTitle = new Adw.WindowTitle({ title: 'node-gtk editor' });
  const header = new Adw.HeaderBar();
  header.setTitleWidget(windowTitle);

  const openButton = Gtk.Button.newFromIconName('document-open-symbolic');
  openButton.setTooltipText('Open (Ctrl+O)');
  openButton.setActionName('app.open');
  header.packStart(openButton);

  const saveButton = Gtk.Button.newFromIconName('document-save-symbolic');
  saveButton.setTooltipText('Save (Ctrl+S)');
  saveButton.setActionName('app.save');
  header.packEnd(saveButton);

  const darkToggle = new Gtk.ToggleButton({ iconName: 'weather-clear-night-symbolic' });
  darkToggle.setTooltipText('Toggle dark mode');
  darkToggle.setActive(styleManager.getDark());
  darkToggle.on('toggled', () => {
    styleManager.setColorScheme(
      darkToggle.getActive() ? Adw.ColorScheme.FORCE_DARK : Adw.ColorScheme.FORCE_LIGHT);
  });
  header.packEnd(darkToggle);

  // --- Window assembly -----------------------------------------------------

  // Vim status line: command bar (`:`, `/`) on the left, pending command
  // preview (e.g. "2dw") on the right — mirroring Vim's bottom row.
  const commandBar = new Gtk.Label({ xalign: 0, hexpand: true });
  const commandPreview = new Gtk.Label({ xalign: 1 });
  commandBar.addCssClass('monospace');
  commandPreview.addCssClass('monospace');
  vim.on('notify::command-bar-text', () => commandBar.setText(vim.getCommandBarText()));
  vim.on('notify::command-text', () => commandPreview.setText(vim.getCommandText()));

  const statusBar = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 });
  statusBar.setMarginStart(6);
  statusBar.setMarginEnd(6);
  statusBar.append(commandBar);
  statusBar.append(commandPreview);

  const toolbarView = new Adw.ToolbarView();
  toolbarView.addTopBar(header);
  toolbarView.setContent(editorBox);
  toolbarView.addBottomBar(statusBar);

  const toastOverlay = new Adw.ToastOverlay();
  toastOverlay.setChild(toolbarView);

  function toast(message) {
    toastOverlay.addToast(new Adw.Toast({ title: message, timeout: 3 }));
  }

  const window = new Adw.ApplicationWindow(app);
  window.setDefaultSize(800, 600);
  window.setContent(toastOverlay);
  window.on('close-request', () => (loop.quit(), app.quit(), false));
  window.present();

  // --- Initial document ----------------------------------------------------

  const arg = process.argv[2];
  loadFile(arg ? Path.resolve(arg) : __filename);

  gi.startLoop();
  loop.run();
});

process.exit(app.run([]));
